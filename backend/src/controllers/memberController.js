const prisma = require('../config/prisma');

// Helper: check if requester is admin
function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

// GET /api/members — authenticated
async function listMembers(req, res) {
  try {
    const { setId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = { isActive: true };

    if (setId) {
      where.setMembers = { some: { setId } };
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          setMembers: { include: { set: { select: { id: true, setName: true, startYear: true, endYear: true } } } },
        },
        skip,
        take,
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ]);

    // PII: only return email to authenticated users
    res.json({
      members: members.map((m) => ({
        id: m.id,
        fullName: m.user.fullName,
        email: m.user.email,
        matricNumber: m.matricNumber,
        gender: m.gender,
        phone: m.phone,
        bio: m.bio,
        profileImage: m.profileImage,
        joinedAt: m.joinedAt,
        sets: m.setMembers.map((sm) => sm.set),
      })),
      total,
      page: parseInt(page),
      limit: take,
    });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/members/search?q= — admin
async function searchMembers(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const members = await prisma.member.findMany({
      where: {
        OR: [
          { user: { fullName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        setMembers: { include: { set: { select: { id: true, setName: true } } } },
      },
      take: 20,
    });

    res.json({
      members: members.map((m) => ({
        id: m.id,
        fullName: m.user.fullName,
        email: m.user.email,
        matricNumber: m.matricNumber,
        sets: m.setMembers.map((sm) => sm.set),
      })),
    });
  } catch (err) {
    console.error('Search members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/members/:id — authenticated
async function getMember(req, res) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        setMembers: { include: { set: true } },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({
      id: member.id,
      fullName: member.user.fullName,
      email: member.user.email,
      matricNumber: member.matricNumber,
      gender: member.gender,
      phone: member.phone,
      address: member.address,
      bio: member.bio,
      profileImage: member.profileImage,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      sets: member.setMembers.map((sm) => ({
        id: sm.set.id,
        setName: sm.set.setName,
        startYear: sm.set.startYear,
        endYear: sm.set.endYear,
        roleInSet: sm.roleInSet,
        bioInSet: sm.bioInSet,
        joinedAt: sm.joinedAt,
      })),
    });
  } catch (err) {
    console.error('Get member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/members/:id — admin
async function updateMember(req, res) {
  try {
    const { matricNumber, gender, phone, address, bio, profileImage, isActive } = req.body;

    const data = {};
    if (matricNumber !== undefined) data.matricNumber = matricNumber;
    if (gender !== undefined) data.gender = gender;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (bio !== undefined) data.bio = bio;
    if (profileImage !== undefined) data.profileImage = profileImage;
    if (isActive !== undefined) data.isActive = isActive;

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    res.json({
      id: member.id,
      fullName: member.user.fullName,
      matricNumber: member.matricNumber,
      gender: member.gender,
      phone: member.phone,
      bio: member.bio,
      profileImage: member.profileImage,
      isActive: member.isActive,
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Member not found' });
    }
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/sets — public
async function listSets(req, res) {
  try {
    const sets = await prisma.graduationSet.findMany({
      include: { _count: { select: { setMembers: true } } },
      orderBy: { startYear: 'desc' },
      where: { isActive: true },
    });

    res.json({
      sets: sets.map((s) => ({
        id: s.id,
        setName: s.setName,
        startYear: s.startYear,
        endYear: s.endYear,
        description: s.description,
        groupInviteLink: s.groupInviteLink,
        memberCount: s._count.setMembers,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('List sets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/sets — admin
async function createSet(req, res) {
  try {
    const { setName, startYear, endYear, description, groupInviteLink } = req.body;
    if (!setName || !startYear || !endYear) {
      return res.status(400).json({ error: 'setName, startYear, endYear are required' });
    }

    const set = await prisma.graduationSet.create({
      data: { setName, startYear, endYear, description, groupInviteLink },
    });

    res.status(201).json({
      id: set.id,
      setName: set.setName,
      startYear: set.startYear,
      endYear: set.endYear,
      description: set.description,
      groupInviteLink: set.groupInviteLink,
      createdAt: set.createdAt,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Set with that name or year range already exists' });
    }
    console.error('Create set error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/sets/:id — admin
async function updateSet(req, res) {
  try {
    const { setName, startYear, endYear, description, groupInviteLink, isActive } = req.body;
    const data = {};
    if (setName !== undefined) data.setName = setName;
    if (startYear !== undefined) data.startYear = startYear;
    if (endYear !== undefined) data.endYear = endYear;
    if (description !== undefined) data.description = description;
    if (groupInviteLink !== undefined) data.groupInviteLink = groupInviteLink;
    if (isActive !== undefined) data.isActive = isActive;

    const set = await prisma.graduationSet.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      id: set.id,
      setName: set.setName,
      startYear: set.startYear,
      endYear: set.endYear,
      description: set.description,
      groupInviteLink: set.groupInviteLink,
      isActive: set.isActive,
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Set not found' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Set with that name or year range already exists' });
    }
    console.error('Update set error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listMembers, searchMembers, getMember, updateMember, listSets, createSet, updateSet };
