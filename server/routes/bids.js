import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();

// GET /bids/my-bids — writer sees their own bids
router.get('/my-bids', verifyToken, roleCheck('writer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, p.title AS project_title, p.budget, p.status AS project_status
       FROM bids b
       JOIN projects p ON b.project_id = p.id
       WHERE b.writer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bids: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /bids/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.first_name, u.last_name, u.rating, p.title AS project_title
       FROM bids b
       JOIN users u ON b.writer_id = u.id
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /projects/:projectId/bids — writer places bid
router.post('/projects/:projectId/bids', verifyToken, roleCheck('writer'), [
  body('amount').isFloat({ min: 5 }),
  body('proposal').trim().isLength({ min: 20 }),
  body('deliveryDays').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId } = req.params;
    const { amount, proposal, deliveryDays } = req.body;

    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    if (projectResult.rows[0].status !== 'open') return res.status(400).json({ error: 'Project is not open for bids' });

    const existingBid = await pool.query(
      'SELECT id FROM bids WHERE project_id = $1 AND writer_id = $2',
      [projectId, req.user.id]
    );
    if (existingBid.rows.length > 0) return res.status(409).json({ error: 'You already placed a bid on this project' });

    const result = await pool.query(
      'INSERT INTO bids (project_id, writer_id, amount, proposal, delivery_days, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [projectId, req.user.id, amount, proposal, deliveryDays, 'pending']
    );

    res.status(201).json({ message: '✅ Bid placed successfully', bid: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /projects/:projectId/bids — client sees bids on their project
router.get('/projects/:projectId/bids', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.first_name, u.last_name, u.rating, u.total_projects_completed
       FROM bids b
       JOIN users u ON b.writer_id = u.id
       WHERE b.project_id = $1
       ORDER BY b.created_at DESC`,
      [req.params.projectId]
    );
    res.json({ bids: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /bids/:id — writer updates their bid
router.put('/:id', verifyToken, roleCheck('writer'), [
  body('amount').optional().isFloat({ min: 5 }),
  body('proposal').optional().trim().isLength({ min: 20 }),
  body('deliveryDays').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const bidResult = await pool.query('SELECT * FROM bids WHERE id = $1 AND writer_id = $2', [req.params.id, req.user.id]);
    if (bidResult.rows.length === 0) return res.status(404).json({ error: 'Bid not found or not yours' });
    if (bidResult.rows[0].status !== 'pending') return res.status(400).json({ error: 'Cannot update a bid that is not pending' });

    const { amount, proposal, deliveryDays } = req.body;
    const result = await pool.query(
      `UPDATE bids SET
        amount = COALESCE($1, amount),
        proposal = COALESCE($2, proposal),
        delivery_days = COALESCE($3, delivery_days),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [amount, proposal, deliveryDays, req.params.id]
    );
    res.json({ message: '✅ Bid updated', bid: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /bids/:id — writer cancels bid
router.delete('/:id', verifyToken, roleCheck('writer'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bids WHERE id = $1 AND writer_id = $2 AND status = $3 RETURNING id',
      [req.params.id, req.user.id, 'pending']
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bid not found or cannot be cancelled' });
    res.json({ message: '✅ Bid cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /projects/:projectId/bids/:bidId/accept — client accepts bid
router.post('/projects/:projectId/bids/:bidId/accept', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const { projectId, bidId } = req.params;

    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1 AND client_id = $2', [projectId, req.user.id]);
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found or not yours' });

    const bidResult = await pool.query('SELECT * FROM bids WHERE id = $1 AND project_id = $2', [bidId, projectId]);
    if (bidResult.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });

    // Accept this bid, reject others
    await pool.query('UPDATE bids SET status = $1 WHERE project_id = $2 AND id != $3', ['rejected', projectId, bidId]);
    await pool.query('UPDATE bids SET status = $1 WHERE id = $2', ['accepted', bidId]);
    await pool.query('UPDATE projects SET status = $1, assigned_writer_id = $2 WHERE id = $3', ['in_progress', bidResult.rows[0].writer_id, projectId]);

    res.json({ message: '✅ Bid accepted. Project is now in progress.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /projects/:projectId/bids/:bidId/reject — client rejects bid
router.post('/projects/:projectId/bids/:bidId/reject', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const { projectId, bidId } = req.params;
    const projectResult = await pool.query('SELECT id FROM projects WHERE id = $1 AND client_id = $2', [projectId, req.user.id]);
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found or not yours' });

    const result = await pool.query(
      'UPDATE bids SET status = $1 WHERE id = $2 AND project_id = $3 RETURNING id',
      ['rejected', bidId, projectId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });
    res.json({ message: '✅ Bid rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
