import { generalRateLimit } from '../middleware/rateLimit.js';
import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
router.use(generalRateLimit);

// POST /reviews — submit review after project completion
router.post('/', verifyToken, [
  body('projectId').isInt(),
  body('revieweeId').isInt(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('feedback').trim().isLength({ min: 10 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId, revieweeId, rating, feedback } = req.body;

    // Verify project is completed and user is part of it
    const projectResult = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND status = $2
       AND (client_id = $3 OR assigned_writer_id = $3)`,
      [projectId, 'completed', req.user.id]
    );
    if (projectResult.rows.length === 0) return res.status(400).json({ error: 'Project not found, not completed, or you were not a participant' });

    // Check no duplicate review
    const existing = await pool.query(
      'SELECT id FROM reviews WHERE project_id = $1 AND reviewer_id = $2',
      [projectId, req.user.id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'You already reviewed this project' });

    const result = await pool.query(
      'INSERT INTO reviews (project_id, reviewer_id, reviewee_id, rating, feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [projectId, req.user.id, revieweeId, rating, feedback]
    );

    // Update reviewee's average rating
    await pool.query(
      `UPDATE users SET
        rating = (SELECT AVG(rating) FROM reviews WHERE reviewee_id = $1),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1)
       WHERE id = $1`,
      [revieweeId]
    );

    res.status(201).json({ message: '✅ Review submitted', review: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/user/:id — get reviews for a user
router.get('/user/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.first_name, u.last_name AS reviewer_last, p.title AS project_title
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       JOIN projects p ON r.project_id = p.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json({ reviews: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /reviews/:id — update review (reviewer only, within 48h)
router.put('/:id', verifyToken, [
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('feedback').optional().trim().isLength({ min: 10 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const reviewResult = await pool.query(
      'SELECT * FROM reviews WHERE id = $1 AND reviewer_id = $2',
      [req.params.id, req.user.id]
    );
    if (reviewResult.rows.length === 0) return res.status(404).json({ error: 'Review not found or not yours' });

    const { rating, feedback } = req.body;
    const result = await pool.query(
      `UPDATE reviews SET
        rating = COALESCE($1, rating),
        feedback = COALESCE($2, feedback),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [rating, feedback, req.params.id]
    );

    // Recalculate rating
    await pool.query(
      `UPDATE users SET
        rating = (SELECT AVG(rating) FROM reviews WHERE reviewee_id = $1)
       WHERE id = $1`,
      [reviewResult.rows[0].reviewee_id]
    );

    res.json({ message: '✅ Review updated', review: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
