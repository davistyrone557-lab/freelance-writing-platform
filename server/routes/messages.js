import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

const createNotification = async (userId, messageId, senderName) => {
  await pool.query(
    'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, 'New message', `${senderName} sent you a message.`, 'message', messageId, 'message']
  );
};

router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (conversation_user_id)
          conversation_user_id AS id,
          u.first_name,
          u.last_name,
          u.avatar_url,
          m.content AS last_message,
          m.created_at AS last_message_at,
          (
            SELECT COUNT(*)
            FROM messages unread
            WHERE unread.sender_id = conversation_user_id
              AND unread.recipient_id = $1
              AND unread.is_read = FALSE
          )::int AS unread_count
       FROM (
          SELECT *,
                 CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS conversation_user_id
          FROM messages
          WHERE sender_id = $1 OR recipient_id = $1
       ) m
       JOIN users u ON u.id = m.conversation_user_id
       ORDER BY conversation_user_id, m.created_at DESC`,
      [req.user.id]
    );

    res.json({ conversations: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations', verifyToken, [
  body('recipientId').isInt().withMessage('recipientId is required'),
  body('content').optional().trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const recipientId = Number(req.body.recipientId);
    if (recipientId === req.user.id) {
      return res.status(400).json({ error: 'You cannot create a conversation with yourself' });
    }

    const userResult = await pool.query(
      'SELECT id, first_name, last_name, avatar_url FROM users WHERE id = $1',
      [recipientId]
    );
    const recipient = userResult.rows[0];

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    let message = null;
    if (req.body.content) {
      const senderResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
      const senderName = `${senderResult.rows[0].first_name} ${senderResult.rows[0].last_name}`.trim();
      const messageResult = await pool.query(
        `INSERT INTO messages (sender_id, recipient_id, content)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, recipientId, req.body.content]
      );
      message = messageResult.rows[0];
      await createNotification(recipientId, message.id, senderName);
    }

    res.status(message ? 201 : 200).json({
      conversation: { id: recipient.id, ...recipient },
      message
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', verifyToken, async (req, res) => {
  try {
    const otherUserId = Number(req.params.id);
    const result = await pool.query(
      `SELECT m.*, s.first_name AS sender_first_name, s.last_name AS sender_last_name
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       WHERE (m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1)
       ORDER BY m.created_at ASC`,
      [req.user.id, otherUserId]
    );

    res.json({ messages: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send', verifyToken, [
  body('recipientId').isInt().withMessage('recipientId is required'),
  body('content').trim().notEmpty().withMessage('Message content is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const recipientId = Number(req.body.recipientId);
    const recipientResult = await pool.query('SELECT id FROM users WHERE id = $1', [recipientId]);
    if (!recipientResult.rows[0]) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const senderResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    const senderName = `${senderResult.rows[0].first_name} ${senderResult.rows[0].last_name}`.trim();
    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, recipientId, req.body.content]
    );

    await createNotification(recipientId, result.rows[0].id, senderName);

    res.status(201).json({ message: 'Message sent successfully', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE id = $1 AND recipient_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message marked as read', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
