const prisma = require('../config/prisma');

// GET /api/members/:id/milestones — authenticated
async function listMilestones(req, res) {
  try {
    const milestones = await prisma.memberMilestone.findMany({
      where: { memberId: req.params.id },
      orderBy: { milestoneDate: 'asc' },
    });

    res.json({ milestones });
  } catch (err) {
    console.error('List milestones error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/members/:id/milestones — member (own only)
async function createMilestone(req, res) {
  try {
    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member || member.id !== req.params.id) {
      return res.status(403).json({ error: 'Can only create milestones for your own profile' });
    }

    const { title, description, milestoneDate } = req.body;
    if (!title || !milestoneDate) {
      return res.status(400).json({ error: 'title and milestoneDate are required' });
    }

    const milestone = await prisma.memberMilestone.create({
      data: {
        memberId: member.id,
        title,
        description: description || null,
        milestoneDate: new Date(milestoneDate),
      },
    });

    res.status(201).json(milestone);
  } catch (err) {
    console.error('Create milestone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/members/:id/milestones/:milestoneId — member (own only)
async function deleteMilestone(req, res) {
  try {
    const member = await prisma.member.findFirst({ where: { userId: req.user.id } });
    if (!member || member.id !== req.params.id) {
      return res.status(403).json({ error: 'Can only delete milestones from your own profile' });
    }

    const milestone = await prisma.memberMilestone.findUnique({
      where: { id: req.params.milestoneId },
    });

    if (!milestone || milestone.memberId !== member.id) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await prisma.memberMilestone.delete({ where: { id: req.params.milestoneId } });
    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    console.error('Delete milestone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listMilestones, createMilestone, deleteMilestone };
