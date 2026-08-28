const prisma = require('../config/prisma');

// GET /api/exco — public, lists current officers with member + position info
async function listCurrentOfficers(req, res) {
  try {
    const officers = await prisma.excoOfficer.findMany({
      where: { isCurrent: true },
      include: {
        position: {
          select: { id: true, title: true, electionYear: true },
        },
        member: {
          include: {
            user: { select: { fullName: true } },
            setMembers: { include: { set: { select: { id: true, setName: true } } } },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    res.json({
      officers: officers.map((o) => ({
        id: o.id,
        positionId: o.positionId,
        position: o.position.title,
        termLabel: o.termLabel,
        startedAt: o.startedAt,
        member: {
          id: o.member.id,
          fullName: o.member.user.fullName,
          profileImage: o.member.profileImage,
          matricNumber: o.member.matricNumber,
          set_name: o.member.setMembers[0]?.set.setName ?? null,
          set_id: o.member.setMembers[0]?.set.id ?? null,
        },
      })),
    });
  } catch (err) {
    console.error('List exco officers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/admin/exco — assign a member to a position for a term (admin)
async function assignOfficer(req, res) {
  try {
    const { positionId, memberId, termLabel } = req.body;
    if (!positionId || !memberId || !termLabel) {
      return res.status(400).json({ error: 'positionId, memberId, and termLabel required' });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const position = await prisma.electionPosition.findUnique({ where: { id: positionId } });
    if (!position) {
      return res.status(404).json({ error: 'Election position not found' });
    }

    // End any current term for this same position (replace outgoing officer)
    await prisma.excoOfficer.updateMany({
      where: { positionId, isCurrent: true },
      data: { isCurrent: false, endedAt: new Date() },
    });

    const officer = await prisma.excoOfficer.create({
      data: {
        positionId,
        memberId,
        termLabel,
        isCurrent: true,
        startedAt: new Date(),
      },
    });

    res.status(201).json({
      id: officer.id,
      positionId: officer.positionId,
      memberId: officer.memberId,
      termLabel: officer.termLabel,
      isCurrent: officer.isCurrent,
      startedAt: officer.startedAt,
    });
  } catch (err) {
    console.error('Assign exco officer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/admin/exco/:id — end a term (admin)
async function endOfficerTerm(req, res) {
  try {
    const officer = await prisma.excoOfficer.update({
      where: { id: req.params.id },
      data: { isCurrent: false, endedAt: new Date() },
    });

    res.json({ message: 'Term ended', id: officer.id, isCurrent: officer.isCurrent });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Officer record not found' });
    }
    console.error('End exco term error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listCurrentOfficers, assignOfficer, endOfficerTerm };