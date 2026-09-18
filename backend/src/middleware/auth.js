const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/prisma');

// Access tokens encode { id, email, role } and are validated on every request.
// A member can be suspended (member.is_active = false) after their access token
// was issued; to make that suspension take effect immediately (not just wait for
// the token to expire), each authenticated request also verifies the acting
// user still has an active member record.
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, member: { select: { isActive: true } } },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: user.id, email: user.email, role: user.role };

    // Suspended members are locked out of every authenticated endpoint — not
    // just login — so a mid-session suspension kicks them immediately.
    if (user.member && user.member.isActive === false) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    next();
  } catch (err) {
    console.error('Authenticate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Super-admin gate (stopgap): a role admin whose email matches the configured
// super-admin address. Only this account may permanently delete a user.
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin' || req.user.email !== config.superAdminEmail) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin };