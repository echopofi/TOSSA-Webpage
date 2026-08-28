const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const { sendRegistrationConfirmation } = require('../services/email');

// Mirror of the client-side rule in frontend/lib/validation.ts — the browser
// check only stops typos; this is the authoritative gate.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const NAME_MAX = 255;
const PHONE_MAX = 30;
const MATRIC_MAX = 50;
const PASSWORD_MAX = 128;
// matches the prisma @db.Uuid ids — a non-UUID setId (e.g. the old "set_2005"
// mock ids) must fail with a clean 400, not a Prisma 500.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
}

async function register(req, res) {
  try {
    const { email, password, fullName, phone, setId, matricNumber, gender, address, bio, profileImage } = req.body;

    // Normalize trimmed inputs before any use.
    const clean = {
      email: typeof email === 'string' ? email.trim().toLowerCase() : email,
      fullName: typeof fullName === 'string' ? fullName.trim() : fullName,
      phone: typeof phone === 'string' ? phone.trim() : phone,
      address: typeof address === 'string' ? address.trim() : address,
      bio: typeof bio === 'string' ? bio.trim() : bio,
      profileImage: typeof profileImage === 'string' ? profileImage.trim() : profileImage,
      matricNumber: typeof matricNumber === 'string' ? matricNumber.trim() : matricNumber,
    };

    if (!clean.email || !password || !clean.fullName || !setId) {
      return res.status(400).json({ error: 'email, password, fullName, and setId are required' });
    }

    if (!EMAIL_REGEX.test(clean.email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (clean.email.length > EMAIL_MAX) {
      return res.status(400).json({ error: 'Email is too long' });
    }
    if (clean.fullName.length > NAME_MAX) {
      return res.status(400).json({ error: 'Full name is too long' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > PASSWORD_MAX) {
      return res.status(400).json({ error: 'Password is too long' });
    }
    if (clean.phone && clean.phone.length > PHONE_MAX) {
      return res.status(400).json({ error: 'Phone number is too long' });
    }
    if (clean.matricNumber && clean.matricNumber.length > MATRIC_MAX) {
      return res.status(400).json({ error: 'Matric number is too long' });
    }

    if (typeof setId !== 'string' || !UUID_REGEX.test(setId)) {
      return res.status(400).json({ error: 'Invalid graduation set' });
    }

    const existing = await prisma.user.findUnique({ where: { email: clean.email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const set = await prisma.graduationSet.findUnique({ where: { id: setId } });
    if (!set) {
      return res.status(400).json({ error: 'Invalid graduation set' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: clean.email,
        passwordHash,
        fullName: clean.fullName,
      },
    });

    const member = await prisma.member.create({
      data: {
        userId: user.id,
        matricNumber: clean.matricNumber || null,
        phone: clean.phone || null,
        gender: gender || null,
        address: clean.address || null,
        bio: clean.bio || null,
        profileImage: clean.profileImage || null,
      },
    });

    await prisma.setMember.create({
      data: {
        memberId: member.id,
        setId,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshHash, expiresAt },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendRegistrationConfirmation({ email: user.email, fullName: user.fullName }).catch(() => {});

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      member: {
        id: member.id,
        matricNumber: member.matricNumber,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Account is not verified' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshHash, expiresAt },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token is invalid or expired' });
    }

    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revoked: true },
    });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newRefreshHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: newRefreshHash, expiresAt },
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const tokenHash = hashToken(token);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true },
      });
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        member: {
          include: {
            setMembers: {
              include: { set: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      member: user.member ? {
        id: user.member.id,
        matricNumber: user.member.matricNumber,
        gender: user.member.gender,
        phone: user.member.phone,
        address: user.member.address,
        bio: user.member.bio,
        profileImage: user.member.profileImage,
        isActive: user.member.isActive,
        joinedAt: user.member.joinedAt,
        sets: user.member.setMembers.map((sm) => ({
          id: sm.set.id,
          setName: sm.set.setName,
          startYear: sm.set.startYear,
          endYear: sm.set.endYear,
          roleInSet: sm.roleInSet,
          joinedAt: sm.joinedAt,
        })),
      } : null,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, refresh, logout, me };
