import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads/avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const selectProfile = `id, email, first_name, last_name, role, avatar_url, bio, hourly_rate, total_earned, total_spent, rating, reviews_count, created_at, updated_at`;

router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${selectProfile} FROM users WHERE id = $1`, [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/me', verifyToken, async (req, res) => {
  try {
    const currentResult = await pool.query(`SELECT ${selectProfile} FROM users WHERE id = $1`, [req.user.id]);
    const currentUser = currentResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {
      first_name: req.body.firstName ?? currentUser.first_name,
      last_name: req.body.lastName ?? currentUser.last_name,
      bio: req.body.bio ?? currentUser.bio,
      hourly_rate: req.body.hourlyRate ?? currentUser.hourly_rate,
      avatar_url: req.body.avatarUrl ?? currentUser.avatar_url
    };

    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           bio = $3,
           hourly_rate = $4,
           avatar_url = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING ${selectProfile}`,
      [updates.first_name, updates.last_name, updates.bio, updates.hourly_rate, updates.avatar_url, req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q = '', role } = req.query;
    const params = [`%${q}%`];
    let query = `SELECT id, first_name, last_name, role, avatar_url, bio, hourly_rate, rating, reviews_count
                 FROM users
                 WHERE is_banned = FALSE
                   AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR COALESCE(bio, '') ILIKE $1)`;

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    query += ' ORDER BY rating DESC, created_at DESC LIMIT 20';

    const result = await pool.query(query, params);
    res.json({ users: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, role, avatar_url, bio, hourly_rate, rating, reviews_count, created_at
       FROM users
       WHERE id = $1 AND is_banned = FALSE`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/me/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  try {
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : req.body.avatarUrl;

    if (!avatarUrl) {
      return res.status(400).json({ error: 'Avatar file or avatarUrl is required' });
    }

    const result = await pool.query(
      `UPDATE users
       SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING ${selectProfile}`,
      [avatarUrl, req.user.id]
    );

    res.json({ message: 'Avatar updated successfully', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
