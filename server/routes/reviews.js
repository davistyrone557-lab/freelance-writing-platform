import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }));

router.post('/projects/:id/reviews', verifyToken, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const projectResult = await client.query(
      `SELECT p.id, p.client_id, p.status, p.title, b.writer_id
       FROM projects p
       LEFT JOIN bids b ON b.project_id = p.id AND b.status = 'accepted'
       WHERE p.id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    const project = projectResult.rows[0];

    if (!project || !project.writer_id) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found or has no accepted writer' });
    }

    if (!['completed', 'approved'].includes(project.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reviews can only be left for completed projects' });
    }

    if (![project.client_id, project.writer_id].includes(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not part of this project' });
    }

    const revieweeId = req.user.id === project.client_id ? project.writer_id : project.client_id;
    const existingReview = await client.query(
      'SELECT id FROM reviews WHERE project_id = $1 AND reviewer_id = $2 AND reviewee_id = $3',
      [req.params.id, req.user.id, revieweeId]
    );

    if (existingReview.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You have already reviewed this user for the project' });
    }

    const reviewResult = await client.query(
      `INSERT INTO reviews (project_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, req.user.id, revieweeId, req.body.rating, req.body.comment || null]
    );

    const statsResult = await client.query(
      'SELECT ROUND(AVG(rating)::numeric, 2) AS rating, COUNT(*)::int AS reviews_count FROM reviews WHERE reviewee_id = $1',
      [revieweeId]
    );
    const stats = statsResult.rows[0];

    await client.query(
      'UPDATE users SET rating = $1, reviews_count = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [stats.rating, stats.reviews_count, revieweeId]
    );

    await client.query(
      'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [revieweeId, 'New review received', `You received a new review for ${project.title}.`, 'review', reviewResult.rows[0].id, 'review']
    );

    await client.query('COMMIT');

    res.status(201).json({ message: 'Review submitted successfully', review: reviewResult.rows[0] });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    res.status(500).json({ error: error.message });
  } finally {
    client?.release();
  }
});

router.get('/users/:id/reviews', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.title AS project_title, reviewer.first_name AS reviewer_first_name, reviewer.last_name AS reviewer_last_name
       FROM reviews r
       JOIN projects p ON p.id = r.project_id
       JOIN users reviewer ON reviewer.id = r.reviewer_id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    res.json({ reviews: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
