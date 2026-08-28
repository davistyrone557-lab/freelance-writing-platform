import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

const createNotification = async (userId, title, message, type, referenceId = null, referenceType = null) => {
  await pool.query(
    'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, title, message, type, referenceId, referenceType]
  );
};

router.post('/projects/:id/bids', verifyToken, roleCheck('writer'), [
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('proposal').trim().notEmpty().withMessage('Proposal is required'),
  body('timeline').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, proposal, timeline } = req.body;
    const projectResult = await pool.query(
      'SELECT id, client_id, status, title FROM projects WHERE id = $1',
      [req.params.id]
    );

    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'open') {
      return res.status(400).json({ error: 'Bids are only allowed on open projects' });
    }

    if (project.client_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot bid on your own project' });
    }

    const existingBid = await pool.query(
      'SELECT id, status FROM bids WHERE project_id = $1 AND writer_id = $2',
      [req.params.id, req.user.id]
    );

    if (existingBid.rows.some((bid) => bid.status === 'pending' || bid.status === 'accepted')) {
      return res.status(409).json({ error: 'You already have an active bid for this project' });
    }

    const result = await pool.query(
      `INSERT INTO bids (project_id, writer_id, amount, proposal, timeline, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.params.id, req.user.id, amount, proposal, timeline || null]
    );

    await createNotification(
      project.client_id,
      'New bid received',
      `A writer submitted a bid for ${project.title}.`,
      'bid_received',
      result.rows[0].id,
      'bid'
    );

    res.status(201).json({ message: 'Bid submitted successfully', bid: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bids/my-bids', verifyToken, roleCheck('writer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.title AS project_title, p.status AS project_status, p.deadline,
              u.first_name AS client_first_name, u.last_name AS client_last_name
       FROM bids b
       JOIN projects p ON p.id = b.project_id
       JOIN users u ON u.id = p.client_id
       WHERE b.writer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    res.json({ bids: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/bids/:id', verifyToken, roleCheck('writer'), [
  body('amount').optional().isFloat({ min: 1 }),
  body('proposal').optional().trim().notEmpty(),
  body('timeline').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const bidResult = await pool.query(
      'SELECT * FROM bids WHERE id = $1 AND writer_id = $2',
      [req.params.id, req.user.id]
    );
    const bid = bidResult.rows[0];

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending bids can be updated' });
    }

    const amount = req.body.amount ?? bid.amount;
    const proposal = req.body.proposal ?? bid.proposal;
    const timeline = req.body.timeline ?? bid.timeline;

    const result = await pool.query(
      `UPDATE bids
       SET amount = $1, proposal = $2, timeline = $3
       WHERE id = $4
       RETURNING *`,
      [amount, proposal, timeline, req.params.id]
    );

    res.json({ message: 'Bid updated successfully', bid: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/bids/:id', verifyToken, roleCheck('writer'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM bids
       WHERE id = $1 AND writer_id = $2 AND status = 'pending'
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Pending bid not found' });
    }

    res.json({ message: 'Bid deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects/:projectId/bids/:bidId/accept', verifyToken, roleCheck('client'), async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const projectResult = await client.query(
      'SELECT id, client_id, title, status FROM projects WHERE id = $1 FOR UPDATE',
      [req.params.projectId]
    );
    const project = projectResult.rows[0];

    if (!project || project.client_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only open projects can accept bids' });
    }

    const bidResult = await client.query(
      `SELECT b.*, u.first_name, u.last_name
       FROM bids b
       JOIN users u ON u.id = b.writer_id
       WHERE b.id = $1 AND b.project_id = $2 FOR UPDATE`,
      [req.params.bidId, req.params.projectId]
    );
    const bid = bidResult.rows[0];

    if (!bid) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bid not found' });
    }

    await client.query(
      `UPDATE bids
       SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END
       WHERE project_id = $2`,
      [req.params.bidId, req.params.projectId]
    );
    await client.query(
      "UPDATE projects SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [req.params.projectId]
    );

    await client.query(
      'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [bid.writer_id, 'Bid accepted', `Your bid for ${project.title} was accepted.`, 'bid_accepted', bid.id, 'bid']
    );

    await client.query('COMMIT');

    res.json({
      message: 'Bid accepted successfully',
      bid: { ...bid, status: 'accepted' },
      writer: `${bid.first_name} ${bid.last_name}`
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
});

router.post('/projects/:projectId/bids/:bidId/reject', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE bids b
       SET status = 'rejected'
       FROM projects p
       WHERE b.id = $1
         AND b.project_id = $2
         AND p.id = b.project_id
         AND p.client_id = $3
         AND b.status = 'pending'
       RETURNING b.*`,
      [req.params.bidId, req.params.projectId, req.user.id]
    );

    const bid = result.rows[0];
    if (!bid) {
      return res.status(404).json({ error: 'Pending bid not found' });
    }

    await createNotification(
      bid.writer_id,
      'Bid update',
      'Your bid was rejected by the client.',
      'bid_rejected',
      bid.id,
      'bid'
    );

    res.json({ message: 'Bid rejected successfully', bid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
