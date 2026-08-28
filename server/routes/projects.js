import express from 'express';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { verifyToken, roleCheck } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get all projects
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
    res.json({
      projects: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project (clients only)
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

    res.status(201).json({
      message: '✅ Project created successfully',
      project: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project by ID
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

export default router;