import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }));
router.use(verifyToken, roleCheck('admin'));

router.get('/users', async (req, res) => {
  try {
    const { q = '', role } = req.query;
    const params = [`%${q}%`];
    let query = `SELECT id, email, first_name, last_name, role, rating, reviews_count, total_earned, total_spent, is_banned, banned_at, created_at
                 FROM users
                 WHERE (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)`;

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query, params);

    res.json({ users: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.first_name AS client_first_name, c.last_name AS client_last_name,
              w.first_name AS writer_first_name, w.last_name AS writer_last_name
       FROM projects p
       JOIN users c ON c.id = p.client_id
       LEFT JOIN bids b ON b.project_id = p.id AND b.status = 'accepted'
       LEFT JOIN users w ON w.id = b.writer_id
       ORDER BY p.created_at DESC
       LIMIT 100`
    );

    res.json({ projects: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban your own admin account' });
    }

    const reason = req.body.reason || 'Account suspended by admin';
    const result = await pool.query(
      `UPDATE users
       SET is_banned = TRUE, banned_at = CURRENT_TIMESTAMP, banned_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, is_banned, banned_at, banned_reason`,
      [reason, req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [user.id, 'Account restricted', reason, 'account_banned']
    );

    res.json({ message: 'User banned successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users/:id/unban', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET is_banned = FALSE, banned_at = NULL, banned_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, first_name, last_name, is_banned, banned_at, banned_reason`,
      [req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [user.id, 'Account reinstated', 'Your account access has been restored by an admin.', 'account_unbanned']
    );

    res.json({ message: 'User unbanned successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const [users, projects, bids, payments, disputes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total_users, COUNT(*) FILTER (WHERE role = 'writer')::int AS writers, COUNT(*) FILTER (WHERE role = 'client')::int AS clients FROM users"),
      pool.query("SELECT COUNT(*)::int AS total_projects, COUNT(*) FILTER (WHERE status = 'open')::int AS open_projects, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_projects FROM projects"),
      pool.query("SELECT COUNT(*)::int AS total_bids, COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted_bids FROM bids"),
      pool.query("SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS gross_volume, COUNT(*)::int AS payment_count FROM payments WHERE status = 'completed'"),
      pool.query("SELECT COUNT(*)::int AS open_disputes FROM disputes WHERE status IN ('open', 'in_review')")
    ]);

    res.json({
      users: users.rows[0],
      projects: projects.rows[0],
      bids: bids.rows[0],
      payments: payments.rows[0],
      disputes: disputes.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
