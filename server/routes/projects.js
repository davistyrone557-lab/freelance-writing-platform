import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

router.get('/', async (req, res) => {
  try {
    const { status, category, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT p.*, u.first_name, u.last_name FROM projects p JOIN users u ON p.client_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND p.status = $' + (params.length + 1);
      params.push(status);
    }
    if (category) {
      query += ' AND p.category = $' + (params.length + 1);
      params.push(category);
    }

    query += ' ORDER BY p.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit);
    params.push(offset);

    const result = await pool.query(query, params);
    res.json({ projects: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, roleCheck('client'), [
  body('title').trim().notEmpty().isLength({ min: 5 }),
  body('description').trim().notEmpty(),
  body('budget').isDecimal().isFloat({ min: 10 }),
  body('category').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { title, description, budget, category, deadline } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (client_id, title, description, budget, category, deadline, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.id, title, description, budget, category, deadline, 'open']
    );

    res.status(201).json({ message: '✅ Project created successfully', project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, u.first_name, u.last_name FROM projects p JOIN users u ON p.client_id = u.id WHERE p.id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const allowedStatuses = ['open', 'cancelled'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Clients can only set project status to open or cancelled through this endpoint' });
    }

    const currentResult = await pool.query('SELECT * FROM projects WHERE id = $1 AND client_id = $2', [req.params.id, req.user.id]);
    const currentProject = currentResult.rows[0];

    if (!currentProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `UPDATE projects
       SET title = $1,
           description = $2,
           budget = $3,
           category = $4,
           status = $5,
           deadline = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND client_id = $8
       RETURNING *`,
      [
        req.body.title ?? currentProject.title,
        req.body.description ?? currentProject.description,
        req.body.budget ?? currentProject.budget,
        req.body.category ?? currentProject.category,
        req.body.status ?? currentProject.status,
        req.body.deadline ?? currentProject.deadline,
        req.params.id,
        req.user.id
      ]
    );

    res.json({ message: 'Project updated successfully', project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
