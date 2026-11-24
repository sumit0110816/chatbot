import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.ts';

// Use configured JWT secret or secure ephemeral runtime secret (never hardcoded)
const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
    ? process.env.JWT_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

export const SESSION_COOKIE_NAME = 'nova_session';

export interface AuthTokenPayload {
  sub: string;
  jti: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: number;
  full_name: string;
  email: string;
  profile_image: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tokenJti?: string;
  tokenExp?: number;
}

export function signAccessToken(
  user: { id: number; email: string },
  rememberMe = false
): { token: string; jti: string; maxAgeMs: number } {
  const jti = crypto.randomUUID();
  const expiresIn = rememberMe ? '30d' : '24h';
  const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const token = jwt.sign(
    { sub: String(user.id), jti, email: user.email },
    JWT_SECRET,
    { expiresIn }
  );
  return { token, jti, maxAgeMs };
}

export function setSessionCookie(req: Request, res: Response, token: string, maxAgeMs: number): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (process.env.APP_URL?.startsWith('https://') ?? false);

  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];

  if (isHttps) {
    cookieParts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    cookieParts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (process.env.APP_URL?.startsWith('https://') ?? false);

  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];

  if (isHttps) {
    cookieParts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    cookieParts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export function extractToken(req: Request): { token: string | null; source: 'bearer' | 'cookie' | null } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  const cookieToken = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  if (cookieToken) return { token: cookieToken, source: 'cookie' };
  return { token: null, source: null };
}

function verifySameOriginForCookieMutation(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  const origin = req.headers.origin;
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith === 'XMLHttpRequest') return true;
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    const expectedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    return originHost === expectedHost;
  } catch {
    return false;
  }
}

export function verifyTokenAndLoadUser(
  token: string
): { user: AuthenticatedUser; payload: AuthTokenPayload } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    if (!decoded.sub || !decoded.jti) return null;

    // Purge expired revoked tokens periodically
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').run(new Date().toISOString());

    const revoked = db
      .prepare('SELECT 1 FROM revoked_tokens WHERE jti = ?')
      .get(decoded.jti);
    if (revoked) return null;

    const userId = Number(decoded.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const user = db
      .prepare(
        'SELECT id, full_name, email, profile_image, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = 1'
      )
      .get(userId) as AuthenticatedUser | undefined;

    if (!user) return null;
    return { user, payload: decoded };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { token, source } = extractToken(req);
  if (!token) {
    res.status(401).json({ detail: 'Authentication required. Please log in.' });
    return;
  }

  if (source === 'cookie' && !verifySameOriginForCookieMutation(req)) {
    res.status(403).json({ detail: 'Cross-origin state-changing request rejected.' });
    return;
  }

  const verified = verifyTokenAndLoadUser(token);
  if (!verified) {
    res.status(401).json({ detail: 'Invalid or expired session. Please log in again.' });
    return;
  }

  req.user = verified.user;
  req.tokenJti = verified.payload.jti;
  req.tokenExp = verified.payload.exp;
  next();
}
