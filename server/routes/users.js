import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();

// GET /users/me — authenticated user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, bio, skills, rating, total_earned, total_spent, total_projects_completed, total_reviews, avatar_url, is_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /users/me — update profile
router.put('/me', verifyToken, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('bio').optional().trim(),
  body('skills').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { firstName, lastName, bio, skills } = req.body;
    const result = await pool.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        bio = COALESCE($3, bio),
        skills = COALESCE($4, skills),
        updated_at = NOW()
       WHERE id = $5 RETURNING id, email, first_name, last_name, role, bio, skills, rating, avatar_url`,
      [firstName, lastName, bio, skills ? JSON.stringify(skills) : null, req.user.id]
    );
    res.json({ message: '✅ Profile updated', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /users/search — search writers
router.get('/search', async (req, res) => {
  try {
    const { q, skills, minRating, limit = 20, offset = 0 } = req.query;
    let query = `SELECT id, first_name, last_name, bio, skills, rating, total_projects_completed, total_reviews, avatar_url
                 FROM users WHERE role = 'writer'`;
    const params = [];

    if (q) {
      query += ` AND (first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1} OR bio ILIKE $${params.length + 1})`;
      params.push(`%${q}%`);
    }
    if (minRating) {
      query += ` AND rating >= $${params.length + 1}`;
      params.push(parseFloat(minRating));
    }

    query += ` ORDER BY rating DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ writers: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /users/:id — public profile
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.bio, u.skills, u.rating, u.total_projects_completed, u.total_reviews, u.avatar_url, u.created_at,
        (SELECT json_agg(r ORDER BY r.created_at DESC) FROM (
          SELECT rv.rating, rv.feedback, rv.created_at, ru.first_name AS reviewer_first, ru.last_name AS reviewer_last
          FROM reviews rv JOIN users ru ON rv.reviewer_id = ru.id
          WHERE rv.reviewee_id = u.id LIMIT 5
        ) r) AS recent_reviews
       FROM users u WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /users/me — account deletion
router.delete('/me', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: '✅ Account deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
