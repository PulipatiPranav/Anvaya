/**
 * JWT authentication and RBAC middleware.
 *
 * requireAuth    — verifies Bearer token, attaches req.user
 * requireRole    — RBAC: fails if caller's role is not in the allowed list
 * requireOwnData — child can only operate on their own username
 * requireTherapistOwnsChild — therapist can only operate on their own children
 */
import jwt from 'jsonwebtoken';
import Child from '../models/Child.js';

// ── requireAuth ─────────────────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7); // strip "Bearer "
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, username, therapistId? }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// ── requireRole ──────────────────────────────────────────────────────────────
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ── requireOwnData ───────────────────────────────────────────────────────────
// Children can only read/write their own records.
// Therapists can read any child they own.
// SuperAdmins can access anything.
export function requireOwnData(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  // Superadmin + therapist see all
  if (req.user.role === 'superadmin' || req.user.role === 'therapist') {
    return next();
  }

  // Child: username in query, params, or body must match JWT identity
  const requestedUsername =
    req.query.username ||
    req.params.username ||
    req.params.childUsername ||
    req.body?.username;

  if (req.user.role === 'child' && requestedUsername && requestedUsername !== req.user.username) {
    return res.status(403).json({ error: 'Access denied: you can only access your own data' });
  }

  next();
}

// ── requireTherapistOwnsChild ────────────────────────────────────────────────
// Verifies the child belongs to the requesting therapist.
// Must be used AFTER requireAuth + requireRole('therapist').
export async function requireTherapistOwnsChild(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  // Superadmin bypasses ownership check
  if (req.user.role === 'superadmin') return next();

  // Therapist ownership check
  if (req.user.role === 'therapist') {
    const childUsername =
      req.params.childUsername ||
      req.query.childUsername ||
      req.body?.childUsername;

    if (!childUsername) return next(); // No child specified — let route validate

    const child = await Child.findOne({
      username: childUsername,
      therapistId: req.user.therapistId,
    }).select('_id').lean();

    if (!child) {
      return res.status(403).json({
        error: 'Access denied: this child is not assigned to your practice',
      });
    }
  }

  next();
}
