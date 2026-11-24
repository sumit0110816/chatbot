import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import { db, withTransaction } from '../db.ts';
import {
  clearSessionCookie,
  extractToken,
  requireAuth,
  setSessionCookie,
  signAccessToken,
  verifyTokenAndLoadUser,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  message: 'Too many authentication attempts. Please wait a minute before trying again.',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getUserSettings(userId: number) {
  return db
    .prepare(
      'SELECT id, user_id, theme, language, response_preferences, created_at, updated_at FROM user_settings WHERE user_id = ?'
    )
    .get(userId);
}

function sendAuthSuccess(
  req: AuthenticatedRequest,
  res: Response,
  user: Record<string, unknown>,
  rememberMe = false,
  statusCode = 200
) {
  const { token, maxAgeMs } = signAccessToken(
    { id: Number(user.id), email: String(user.email) },
    rememberMe
  );
  setSessionCookie(req, res, token, maxAgeMs);
  const settings = getUserSettings(Number(user.id));
  res.status(statusCode).json({
    access_token: token,
    token_type: 'bearer',
    user,
    settings,
  });
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { full_name, email, password, confirm_password, terms_accepted } = req.body ?? {};

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      res.status(400).json({ detail: 'Full name must be at least 2 characters.' });
      return;
    }

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ detail: 'Please provide a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ detail: 'Password must be at least 8 characters long.' });
      return;
    }

    if (password !== confirm_password) {
      res.status(400).json({ detail: 'Passwords do not match.' });
      return;
    }

    if (!terms_accepted) {
      res.status(400).json({ detail: 'You must accept the Terms and Conditions to continue.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ detail: 'An account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user = withTransaction(() => {
      const insertUser = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)`
        )
        .run(full_name.trim(), normalizedEmail, passwordHash, now, now);

      const userId = Number(insertUser.lastInsertRowid);

      db.prepare(
        `INSERT INTO user_settings (user_id, theme, language, response_preferences, created_at, updated_at)
         VALUES (?, 'light', 'English', 'Balanced, clear, and well-structured', ?, ?)`
      ).run(userId, now, now);

      return db
        .prepare(
          'SELECT id, full_name, email, profile_image, is_active, created_at, updated_at FROM users WHERE id = ?'
        )
        .get(userId) as Record<string, unknown>;
    });

    sendAuthSuccess(req, res, user, false, 201);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ detail: 'Unable to create account right now.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, remember_me } = req.body ?? {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ detail: 'Please enter a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ detail: 'Please enter your password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = db
      .prepare(
        'SELECT id, full_name, email, password_hash, profile_image, is_active, created_at, updated_at FROM users WHERE email = ?'
      )
      .get(normalizedEmail) as
      | (Record<string, unknown> & { password_hash: string; is_active: number })
      | undefined;

    if (!record || !record.is_active) {
      res.status(401).json({ detail: 'Invalid email or password.' });
      return;
    }

    const matches = await bcrypt.compare(password, record.password_hash);
    if (!matches) {
      res.status(401).json({ detail: 'Invalid email or password.' });
      return;
    }

    const { password_hash: _removed, ...safeUser } = record;
    sendAuthSuccess(req, res, safeUser, Boolean(remember_me), 200);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ detail: 'Unable to log in right now.' });
  }
});

router.post('/demo', authLimiter, async (req, res) => {
  try {
    const demoEmail = 'demo@nova-ai.local';
    let user = db
      .prepare(
        'SELECT id, full_name, email, profile_image, is_active, created_at, updated_at FROM users WHERE email = ?'
      )
      .get(demoEmail) as Record<string, unknown> | undefined;

    if (!user) {
      const now = new Date().toISOString();
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = withTransaction(() => {
        const result = db
          .prepare(
            `INSERT INTO users (full_name, email, password_hash, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, ?)`
          )
          .run('Alex Mercer (Demo)', demoEmail, passwordHash, now, now);

        const userId = Number(result.lastInsertRowid);
        db.prepare(
          `INSERT INTO user_settings (user_id, theme, language, response_preferences, created_at, updated_at)
           VALUES (?, 'light', 'English', 'Balanced, clear, and well-structured', ?, ?)`
        ).run(userId, now, now);

        return db
          .prepare(
            'SELECT id, full_name, email, profile_image, is_active, created_at, updated_at FROM users WHERE id = ?'
          )
          .get(userId) as Record<string, unknown>;
      });
    }

    sendAuthSuccess(req, res, user, false, 200);
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ detail: 'Unable to start demo session.' });
  }
});

router.post('/logout', (req: AuthenticatedRequest, res) => {
  const { token } = extractToken(req);
  if (token) {
    const verified = verifyTokenAndLoadUser(token);
    if (verified?.payload?.jti) {
      const expiresAt = verified.payload.exp
        ? new Date(verified.payload.exp * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(
        verified.payload.jti,
        expiresAt
      );
    }
  }
  clearSessionCookie(req, res);
  res.json({ ok: true, message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const { token } = extractToken(req);
  const settings = getUserSettings(req.user!.id);
  res.json({
    access_token: token,
    user: req.user,
    settings,
  });
});

router.post('/forgot-password', authLimiter, (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ detail: 'Please provide a valid email address.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db
      .prepare('SELECT id, email, is_active FROM users WHERE email = ?')
      .get(normalizedEmail) as { id: number; email: string; is_active: number } | undefined;

    let previewResetToken: string | undefined;

    if (user && user.is_active) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

      db.prepare(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(user.id, tokenHash, expiresAt, now.toISOString());

      // In local/preview environments without an external SMTP relay, return the one-time token
      // directly so the user can complete the reset flow end-to-end.
      if (!process.env.SMTP_HOST) {
        previewResetToken = rawToken;
      }
    }

    res.json({
      message:
        'If an account exists for that email address, a password reset link has been generated.',
      ...(previewResetToken ? { reset_token: previewResetToken } : {}),
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ detail: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body ?? {};

    if (!token || typeof token !== 'string') {
      res.status(400).json({ detail: 'A valid reset token is required.' });
      return;
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      res.status(400).json({ detail: 'New password must be at least 8 characters long.' });
      return;
    }

    if (new_password !== confirm_password) {
      res.status(400).json({ detail: 'Passwords do not match.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const resetRow = db
      .prepare(
        `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = ?`
      )
      .get(tokenHash) as
      | { id: number; user_id: number; expires_at: string; used_at: string | null }
      | undefined;

    if (!resetRow || resetRow.used_at !== null) {
      res.status(400).json({ detail: 'This password reset link is invalid or has already been used.' });
      return;
    }

    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ detail: 'This password reset link has expired. Please request a new one.' });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const now = new Date().toISOString();

    withTransaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        newHash,
        now,
        resetRow.user_id
      );
      db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, resetRow.id);
    });

    res.json({ message: 'Your password has been reset. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ detail: 'Unable to reset password right now.' });
  }
});

export default router;
