import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

router.get('/profile', (req: AuthenticatedRequest, res) => {
  const settings = db
    .prepare(
      'SELECT id, user_id, theme, language, response_preferences, created_at, updated_at FROM user_settings WHERE user_id = ?'
    )
    .get(req.user!.id);

  res.json({ user: req.user, settings });
});

router.patch('/profile', (req: AuthenticatedRequest, res) => {
  const { full_name, profile_image } = req.body ?? {};
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || full_name.trim().length < 2) {
      res.status(400).json({ detail: 'Full name must be at least 2 characters.' });
      return;
    }
    updates.push('full_name = ?');
    params.push(full_name.trim().slice(0, 120));
  }

  if (profile_image !== undefined) {
    if (profile_image === null || profile_image === '') {
      updates.push('profile_image = ?');
      params.push(null);
    } else if (
      typeof profile_image === 'string' &&
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(profile_image) &&
      profile_image.length <= 2_000_000
    ) {
      updates.push('profile_image = ?');
      params.push(profile_image);
    } else {
      res.status(400).json({
        detail: 'Profile image must be a valid PNG, JPEG, WEBP, or GIF image under 1.5MB.',
      });
      return;
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ detail: 'No profile fields provided to update.' });
    return;
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  params.push(now, req.user!.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updatedUser = db
    .prepare(
      'SELECT id, full_name, email, profile_image, is_active, created_at, updated_at FROM users WHERE id = ?'
    )
    .get(req.user!.id);

  res.json({ user: updatedUser });
});

router.patch('/password', async (req: AuthenticatedRequest, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body ?? {};

    if (!current_password || typeof current_password !== 'string') {
      res.status(400).json({ detail: 'Current password is required.' });
      return;
    }
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      res.status(400).json({ detail: 'New password must be at least 8 characters long.' });
      return;
    }
    if (new_password !== confirm_password) {
      res.status(400).json({ detail: 'New passwords do not match.' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.id) as { password_hash: string } | undefined;

    if (!row) {
      res.status(404).json({ detail: 'User not found.' });
      return;
    }

    const matches = await bcrypt.compare(current_password, row.password_hash);
    if (!matches) {
      res.status(400).json({ detail: 'Current password is incorrect.' });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      now,
      req.user!.id
    );

    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ detail: 'Unable to update password right now.' });
  }
});

router.patch('/settings', (req: AuthenticatedRequest, res) => {
  const { theme, language, response_preferences } = req.body ?? {};
  const updates: string[] = [];
  const params: Array<string | number> = [];

  if (theme !== undefined) {
    if (theme !== 'light' && theme !== 'dark') {
      res.status(400).json({ detail: 'Theme must be either light or dark.' });
      return;
    }
    updates.push('theme = ?');
    params.push(theme);
  }

  if (language !== undefined) {
    if (typeof language !== 'string' || !language.trim()) {
      res.status(400).json({ detail: 'Language must be a non-empty string.' });
      return;
    }
    updates.push('language = ?');
    params.push(language.trim().slice(0, 40));
  }

  if (response_preferences !== undefined) {
    if (typeof response_preferences !== 'string' || !response_preferences.trim()) {
      res.status(400).json({ detail: 'Response preferences cannot be empty.' });
      return;
    }
    updates.push('response_preferences = ?');
    params.push(response_preferences.trim().slice(0, 500));
  }

  if (updates.length === 0) {
    res.status(400).json({ detail: 'No settings fields provided to update.' });
    return;
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  params.push(now, req.user!.id);

  db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);

  const settings = db
    .prepare(
      'SELECT id, user_id, theme, language, response_preferences, created_at, updated_at FROM user_settings WHERE user_id = ?'
    )
    .get(req.user!.id);

  res.json({ settings });
});

export default router;
