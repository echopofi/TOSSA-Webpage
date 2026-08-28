const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config');
const { sendRegistrationConfirmation } = require('../services/email');

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

    if (!email || !password || !fullName || !setId) {
      return res.status(400).json({ error: 'email, password, fullName, and setId are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
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
        email: email.toLowerCase(),
        passwordHash,
        fullName,
      },
    });

    const member = await prisma.member.create({
      data: {
        userId: user.id,
        matricNumber: matricNumber || null,
        phone: phone || null,
        gender: gender || null,
        address: address || null,
        bio: bio || null,
        profileImage: profileImage || null,
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

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
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
