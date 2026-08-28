import { generalRateLimit } from '../middleware/rateLimit.js';
import express from 'express';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();
router.use(generalRateLimit);

// All admin routes require authentication and admin role
router.use(verifyToken, roleCheck('admin'));

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { role, status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT id, email, first_name, last_name, role, is_verified, is_banned, rating, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) { query += ` AND role = $${params.length + 1}`; params.push(role); }
    if (status === 'banned') { query += ` AND is_banned = true`; }
    if (status === 'unverified') { query += ` AND is_verified = false`; }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ users: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/projects
router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.first_name, u.last_name, u.email
       FROM projects p JOIN users u ON p.client_id = u.id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ projects: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/users/:id/ban
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      'UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2',
      [reason || 'Violation of terms of service', req.params.id]
    );
    res.json({ message: '✅ User banned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_banned = false, ban_reason = NULL WHERE id = $1', [req.params.id]);
    res.json({ message: '✅ User unbanned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/analytics
router.get('/analytics', async (req, res) => {
  try {
    const [usersResult, projectsResult, paymentsResult, recentUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE role = \'writer\') AS writers, COUNT(*) FILTER (WHERE role = \'client\') AS clients FROM users'),
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = \'open\') AS open, COUNT(*) FILTER (WHERE status = \'completed\') AS completed FROM projects'),
      pool.query('SELECT COALESCE(SUM(amount), 0) AS total_volume, COUNT(*) AS total_transactions FROM payments WHERE status = \'completed\''),
      pool.query('SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5')
    ]);

    res.json({
      users: usersResult.rows[0],
      projects: projectsResult.rows[0],
      payments: paymentsResult.rows[0],
      recentUsers: recentUsers.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    await pool.query(
      'UPDATE disputes SET status = $1, resolution = $2, resolved_at = NOW() WHERE id = $3',
      ['resolved', resolution, req.params.id]
    );
    res.json({ message: '✅ Dispute resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
