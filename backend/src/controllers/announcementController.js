const prisma = require('../config/prisma');

// GET /api/announcements — authenticated
async function listAnnouncements(req, res) {
  try {
    const where = {
      isPublished: true,
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: new Date() } },
      ],
    };

    // Non-admin: only global + their set's announcements
    if (req.user.role !== 'admin') {
      const member = await prisma.member.findFirst({
        where: { userId: req.user.id },
        include: { setMembers: { select: { setId: true } } },
      });

      if (member) {
        const setIds = member.setMembers.map((sm) => sm.setId);
        where.AND = [
          {
            OR: [
              { targetType: 'all_members' },
              { setId: { in: setIds } },
              { targetMemberId: member.id },
            ],
          },
        ];
      } else {
        where.targetType = 'all_members';
      }
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true } },
        set: { select: { id: true, setName: true } },
        targetMember: { select: { id: true, user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        targetType: a.targetType,
        set: a.set ? { id: a.set.id, setName: a.set.setName } : null,
        targetMember: a.targetMember ? { id: a.targetMember.id, fullName: a.targetMember.user.fullName } : null,
        scheduledAt: a.scheduledAt,
        publishedAt: a.publishedAt,
        createdBy: { id: a.author.id, fullName: a.author.fullName },
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('List announcements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/announcements — admin
async function createAnnouncement(req, res) {
  try {
    const { title, content, targetType, setId, targetMemberId, scheduledAt } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const validTypes = ['all_members', 'set', 'member'];
    const type = targetType || 'all_members';
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'targetType must be all_members, set, or member' });
    }

    if (type === 'set' && setId) {
      const set = await prisma.graduationSet.findUnique({ where: { id: setId } });
      if (!set) {
        return res.status(400).json({ error: 'Invalid target set' });
      }
    }

    if (type === 'member' && targetMemberId) {
      const member = await prisma.member.findUnique({ where: { id: targetMemberId } });
      if (!member) {
        return res.status(400).json({ error: 'Invalid target member' });
      }
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        targetType: type,
        setId: type === 'set' ? setId : null,
        targetMemberId: type === 'member' ? targetMemberId : null,
        createdBy: req.user.id,
        isPublished: !isScheduled,
        scheduledAt: isScheduled ? new Date(scheduledAt) : null,
        publishedAt: isScheduled ? null : new Date(),
      },
    });

    res.status(201).json({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      targetType: announcement.targetType,
      scheduledAt: announcement.scheduledAt,
      createdAt: announcement.createdAt,
    });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/announcements/:id — admin
async function updateAnnouncement(req, res) {
  try {
    const { title, content, targetType, setId, targetMemberId, scheduledAt, isPublished } = req.body;

    const data = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (targetType !== undefined) data.targetType = targetType;
    if (setId !== undefined) data.setId = setId;
    if (targetMemberId !== undefined) data.targetMemberId = targetMemberId;
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (isPublished !== undefined) data.isPublished = isPublished;

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      targetType: announcement.targetType,
      scheduledAt: announcement.scheduledAt,
      isPublished: announcement.isPublished,
      createdAt: announcement.createdAt,
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    console.error('Update announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/announcements/:id — admin
async function deleteAnnouncement(req, res) {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
