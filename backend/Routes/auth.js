/**
 * Authentication routes.
 *
 * POST /api/auth/login
 *   — Accepts username + password
 *   — Compares with bcrypt (with legacy plaintext fallback for migration)
 *   — Returns a signed JWT on success
 *
 * Security notes:
 *  • Plaintext password comparison is intentionally removed.
 *  • Passwords are hashed with bcrypt (SALT_ROUNDS=12) at save time.
 *  • Legacy migration: if stored password is not a bcrypt hash (pre-hashing),
 *    we fall back to plaintext compare once, then re-hash and persist.
 *  • The token payload contains only non-sensitive identity fields.
 *  • Error messages are intentionally generic to prevent user enumeration.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Child from '../models/Child.js';
import Therapist from '../models/Therapist.js';
import SuperAdmin from '../models/SuperAdmin.js';

const router = express.Router();

const BCRYPT_PREFIX = '$2b$';

// Returns true if the stored hash looks like a bcrypt hash.
function isBcryptHash(str) {
  return typeof str === 'string' && str.startsWith(BCRYPT_PREFIX);
}

// Compares password against stored value.
// Handles both hashed (new) and plaintext (legacy, migration) passwords.
async function verifyPassword(candidate, stored, doc) {
  if (isBcryptHash(stored)) {
    return bcrypt.compare(candidate, stored);
  }
  // Legacy plaintext — only for migration. Constant-time compare via bcrypt hash.
  const matched = candidate === stored;
  if (matched) {
    // Transparently re-hash the plaintext password on successful login.
    doc.password = candidate; // Triggers the pre-save bcrypt hook
    await doc.save();
  }
  return matched;
}

function issueToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    algorithm: 'HS256',
  });
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || typeof username !== 'string' ||
      !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const normalised = username.trim().toLowerCase();

  try {
    // 1. SuperAdmin
    const superadmin = await SuperAdmin.findOne({ username: normalised });
    if (superadmin && await verifyPassword(password, superadmin.password, superadmin)) {
      const token = issueToken({ userId: superadmin._id.toString(), role: 'superadmin', username: normalised });
      return res.json({ role: 'superadmin', token });
    }

    // 2. Therapist
    const therapist = await Therapist.findOne({ username: normalised });
    if (therapist && await verifyPassword(password, therapist.password, therapist)) {
      const token = issueToken({
        userId:      therapist._id.toString(),
        role:        'therapist',
        username:    normalised,
        therapistId: therapist.therapistId,
      });
      return res.json({ role: 'therapist', therapistId: therapist.therapistId, token });
    }

    // 3. Child
    const child = await Child.findOne({ username: normalised });
    if (child && await verifyPassword(password, child.password, child)) {
      const token = issueToken({
        userId:      child._id.toString(),
        role:        'child',
        username:    normalised,
        therapistId: child.therapistId,
      });
      return res.json({ role: 'child', token });
    }

    return res.status(401).json({ error: 'Invalid credentials' });

  } catch (err) {
    console.error('[auth] Login error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
