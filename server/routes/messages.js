import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /messages/conversations
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        u1.first_name AS participant1_first, u1.last_name AS participant1_last,
        u2.first_name AS participant2_first, u2.last_name AS participant2_last,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.receiver_id = $1 AND m.is_read = false) AS unread_count
       FROM conversations c
       JOIN users u1 ON c.participant1_id = u1.id
       JOIN users u2 ON c.participant2_id = u2.id
       WHERE c.participant1_id = $1 OR c.participant2_id = $1
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /messages/conversations — start or retrieve conversation
router.post('/conversations', verifyToken, [
  body('recipientId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { recipientId } = req.body;
    if (req.user.id === parseInt(recipientId)) return res.status(400).json({ error: 'Cannot message yourself' });

    const existing = await pool.query(
      `SELECT * FROM conversations
       WHERE (participant1_id = $1 AND participant2_id = $2)
          OR (participant1_id = $2 AND participant2_id = $1)`,
      [req.user.id, recipientId]
    );

    if (existing.rows.length > 0) return res.json({ conversation: existing.rows[0] });

    const result = await pool.query(
      'INSERT INTO conversations (participant1_id, participant2_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, recipientId]
    );
    res.status(201).json({ conversation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /messages/conversations/:id — get messages in conversation
router.get('/conversations/:id', verifyToken, async (req, res) => {
  try {
    const convResult = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [req.params.id, req.user.id]
    );
    if (convResult.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    // Mark messages as read
    await pool.query(
      'UPDATE messages SET is_read = true WHERE conversation_id = $1 AND receiver_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /messages/send
router.post('/send', verifyToken, [
  body('conversationId').isInt(),
  body('content').trim().isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { conversationId, content } = req.body;

    const convResult = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)',
      [conversationId, req.user.id]
    );
    if (convResult.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const conversation = convResult.rows[0];
    const receiverId = conversation.participant1_id === req.user.id
      ? conversation.participant2_id
      : conversation.participant1_id;

    const result = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [conversationId, req.user.id, receiverId, content]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /messages/:id/read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND receiver_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: '✅ Message marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /messages/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found or not yours' });
    res.json({ message: '✅ Message deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
