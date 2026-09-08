const prisma = require('../config/prisma');
const { deleteImage } = require('../services/cloudinary');

// Helper: check if requester is admin
function isAdmin(req) {
  return req.user && req.user.role === 'admin';
}

// Reject data URLs/base64 — set images must be real (Cloudinary) URLs, same
// guard the auth controller applies to member profile photos.
function isValidImageUrl(url) {
  return typeof url === 'string' && url.length > 0 && url.length <= 2000 && !/^data:/i.test(url);
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

// PUT /api/members/me/photo — member updates their own profile photo
async function updateOwnPhoto(req, res) {
  try {
    const { profileImage } = req.body;
    if (!profileImage || typeof profileImage !== 'string') {
      return res.status(400).json({ error: 'profileImage URL is required' });
    }

    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { profileImage },
    });

    res.json({ id: updated.id, profileImage: updated.profileImage });
  } catch (err) {
    console.error('Update own photo error:', err);
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
      include: {
        _count: { select: { setMembers: true } },
        setImages: { orderBy: { createdAt: 'asc' } },
      },
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
        coverImage: s.coverImage,
        coverImageCaption: s.coverImageCaption,
        setImages: s.setImages.map((si) => ({
          id: si.id,
          imageUrl: si.imageUrl,
          createdAt: si.createdAt,
        })),
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
    const { setName, startYear, endYear, description, groupInviteLink, coverImage, coverImageCaption } = req.body;
    if (!setName || !startYear || !endYear) {
      return res.status(400).json({ error: 'setName, startYear, endYear are required' });
    }
    if (endYear - startYear !== 6) {
      return res.status(400).json({ error: 'A set must span exactly 6 years (endYear - startYear must equal 6)' });
    }
    if (coverImage !== undefined && !isValidImageUrl(coverImage)) {
      return res.status(400).json({ error: 'coverImage must be an uploaded image URL' });
    }

    const set = await prisma.graduationSet.create({
      data: {
        setName, startYear, endYear, description, groupInviteLink,
        coverImage: coverImage || null,
        coverImageCaption: coverImageCaption || null,
      },
    });

    res.status(201).json({
      id: set.id,
      setName: set.setName,
      startYear: set.startYear,
      endYear: set.endYear,
      description: set.description,
      groupInviteLink: set.groupInviteLink,
      coverImage: set.coverImage,
      coverImageCaption: set.coverImageCaption,
      setImages: [],
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
    const { setName, startYear, endYear, description, groupInviteLink, coverImage, coverImageCaption, isActive } = req.body;
    const data = {};
    if (setName !== undefined) data.setName = setName;
    if (startYear !== undefined) data.startYear = startYear;
    if (endYear !== undefined) data.endYear = endYear;
    if (description !== undefined) data.description = description;
    if (groupInviteLink !== undefined) data.groupInviteLink = groupInviteLink;
    if (isActive !== undefined) data.isActive = isActive;
    if (coverImageCaption !== undefined) data.coverImageCaption = coverImageCaption || null;
    if (coverImage !== undefined) {
      if (!isValidImageUrl(coverImage !== null ? coverImage : '')) {
        return res.status(400).json({ error: 'coverImage must be an uploaded image URL' });
      }
      data.coverImage = coverImage || null;
    }

    // Enforce the 6-year span against the effective (resulting) values, since
    // startYear/endYear may be updated independently via partial PATCH-style PUT.
    if (startYear !== undefined || endYear !== undefined) {
      const existingYear = await prisma.graduationSet.findUnique({
        where: { id: req.params.id },
        select: { startYear: true, endYear: true },
      });
      if (!existingYear) {
        return res.status(404).json({ error: 'Set not found' });
      }
      const effectiveStart = startYear !== undefined ? startYear : existingYear.startYear;
      const effectiveEnd   = endYear !== undefined ? endYear : existingYear.endYear;
      if (effectiveEnd - effectiveStart !== 6) {
        return res.status(400).json({ error: 'A set must span exactly 6 years (endYear - startYear must equal 6)' });
      }
    }

    let oldCoverUrl = null;
    if (data.coverImage !== undefined) {
      const existing = await prisma.graduationSet.findUnique({
        where: { id: req.params.id },
        select: { coverImage: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Set not found' });
      }
      oldCoverUrl = existing.coverImage;
    }

    const set = await prisma.graduationSet.update({
      where: { id: req.params.id },
      data,
    });

    // Cover slot semantics: replacing/nulling the cover deletes the old asset
    // from Cloudinary so we never leave orphaned images behind.
    if (data.coverImage !== undefined && oldCoverUrl && oldCoverUrl !== data.coverImage) {
      await deleteImage(oldCoverUrl);
    }

    res.json({
      id: set.id,
      setName: set.setName,
      startYear: set.startYear,
      endYear: set.endYear,
      description: set.description,
      groupInviteLink: set.groupInviteLink,
      coverImage: set.coverImage,
      coverImageCaption: set.coverImageCaption,
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

// PUT /api/admin/sets/:id/cover — admin
// Single-slot cover: a new URL replaces the existing one (old asset deleted
// from Cloudinary first); passing coverImage: null clears the cover.
async function updateSetCover(req, res) {
  try {
    const { coverImage, coverImageCaption } = req.body;

    const existing = await prisma.graduationSet.findUnique({
      where: { id: req.params.id },
      select: { id: true, coverImage: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Set not found' });
    }

    if (coverImage !== undefined && !isValidImageUrl(coverImage !== null ? coverImage : '')) {
      return res.status(400).json({ error: 'coverImage must be an uploaded image URL' });
    }
    const nextCover = coverImage !== undefined ? (coverImage || null) : undefined;

    const updateData = {};
    if (nextCover !== undefined) updateData.coverImage = nextCover;
    if (coverImageCaption !== undefined) updateData.coverImageCaption = coverImageCaption || null;

    const set = await prisma.graduationSet.update({
      where: { id: req.params.id },
      data: updateData,
      include: { setImages: { orderBy: { createdAt: 'asc' } } },
    });

    if (nextCover !== undefined && existing.coverImage && existing.coverImage !== nextCover) {
      await deleteImage(existing.coverImage);
    }

    res.json({
      id: set.id,
      setName: set.setName,
      coverImage: set.coverImage,
      coverImageCaption: set.coverImageCaption,
      setImages: set.setImages.map((si) => ({ id: si.id, imageUrl: si.imageUrl, createdAt: si.createdAt })),
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Set not found' });
    }
    console.error('Update set cover error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/admin/sets/:id/images — admin
// Gallery is an append-only collection: add an image URL, it gets a new row.
async function addSetImage(req, res) {
  try {
    const { imageUrl } = req.body;
    if (!isValidImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'imageUrl must be an uploaded image URL' });
    }

    const set = await prisma.graduationSet.findUnique({ where: { id: req.params.id } });
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const image = await prisma.setImage.create({
      data: { setId: set.id, imageUrl },
    });

    res.status(201).json({
      id: image.id,
      imageUrl: image.imageUrl,
      createdAt: image.createdAt,
    });
  } catch (err) {
    console.error('Add set image error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/admin/sets/:id/images/:imageId — admin
// Removing a gallery image deletes the Cloudinary asset then the DB record.
async function removeSetImage(req, res) {
  try {
    const image = await prisma.setImage.findFirst({
      where: { id: req.params.imageId, setId: req.params.id },
    });
    if (!image) {
      return res.status(404).json({ error: 'Set image not found' });
    }

    await prisma.setImage.delete({ where: { id: image.id } });
    await deleteImage(image.imageUrl);

    res.json({ message: 'Set image removed' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Set image not found' });
    }
    console.error('Remove set image error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listMembers, searchMembers, getMember, updateOwnPhoto, updateMember, listSets, createSet, updateSet, updateSetCover, addSetImage, removeSetImage };
