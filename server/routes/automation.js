import express from 'express';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';
import { generalRateLimit } from '../middleware/rateLimit.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
router.use(generalRateLimit);
router.use(verifyToken);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const platformFeePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || 10) / 100;

async function createNotification(userId, type, title, body, data = null) {
  if (!userId) return;

  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );
}

async function findEscrowPayment(projectId, clientId) {
  const result = await pool.query(
    `SELECT *
     FROM payments
     WHERE project_id = $1
       AND user_id = $2
       AND status = 'completed'
       AND type IN ('payment', 'deposit')
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId, clientId]
  );

  return result.rows[0] || null;
}

async function releaseProjectFunds(project) {
  const db = await pool.connect();

  try {
    await db.query('BEGIN');

    const existingPayout = await db.query(
      `SELECT id
       FROM payments
       WHERE project_id = $1
         AND user_id = $2
         AND type = 'payment'
         AND status = 'completed'
       LIMIT 1`,
      [project.id, project.writer_id]
    );

    if (existingPayout.rows.length > 0) {
      await db.query('ROLLBACK');
      return { released: false, reason: 'already_released' };
    }

    const escrowPayment = await db.query(
      `SELECT *
       FROM payments
       WHERE project_id = $1
         AND user_id = $2
         AND status = 'completed'
         AND type IN ('payment', 'deposit')
       ORDER BY created_at DESC
       LIMIT 1`,
      [project.id, project.client_id]
    );

    if (escrowPayment.rows.length === 0) {
      await db.query('ROLLBACK');
      return { released: false, reason: 'missing_payment' };
    }

    const escrowAmount = Number(escrowPayment.rows[0].amount || project.budget);
    const writerAmount = escrowAmount * (1 - platformFeePercentage);

    await db.query(
      `UPDATE users
       SET total_earned = total_earned + $1,
           total_projects_completed = total_projects_completed + 1
       WHERE id = $2`,
      [writerAmount, project.writer_id]
    );

    await db.query(
      `INSERT INTO payments (user_id, project_id, amount, type, status, stripe_transaction_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        project.writer_id,
        project.id,
        writerAmount,
        'payment',
        'completed',
        escrowPayment.rows[0].stripe_transaction_id,
        'Automated project payout release'
      ]
    );

    await db.query('COMMIT');
    return { released: true, writerAmount };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function processOverdueProject(project) {
  const existingDispute = await pool.query(
    `SELECT id
     FROM disputes
     WHERE project_id = $1
       AND status IN ('open', 'resolved')
     LIMIT 1`,
    [project.id]
  );

  if (existingDispute.rows.length > 0) {
    return { processed: false, reason: 'already_flagged' };
  }

  const existingRefund = await pool.query(
    `SELECT id
     FROM payments
     WHERE project_id = $1
       AND user_id = $2
       AND type = 'refund'
       AND status = 'completed'
     LIMIT 1`,
    [project.id, project.client_id]
  );

  if (existingRefund.rows.length > 0) {
    return { processed: false, reason: 'already_refunded' };
  }

  const escrowPayment = await findEscrowPayment(project.id, project.client_id);
  let refundId = null;

  if (escrowPayment?.stripe_transaction_id) {
    const refund = await stripe.refunds.create({
      payment_intent: escrowPayment.stripe_transaction_id,
      amount: Math.round(Number(escrowPayment.amount || project.budget) * 100),
      reason: 'requested_by_customer',
      metadata: {
        projectId: String(project.id),
        reason: 'Project not completed by deadline'
      }
    });

    refundId = refund.id;
  }

  const db = await pool.connect();

  try {
    await db.query('BEGIN');

    await db.query(
      `INSERT INTO disputes (project_id, raised_by, against_user, reason, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        project.id,
        project.client_id,
        project.writer_id,
        'Project not completed by deadline',
        'open'
      ]
    );

    await db.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', project.id]
    );

    if (refundId) {
      await db.query(
        `INSERT INTO payments (user_id, project_id, amount, type, status, stripe_transaction_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          project.client_id,
          project.id,
          Number(escrowPayment.amount || project.budget),
          'refund',
          'completed',
          refundId,
          'Automated refund for overdue project'
        ]
      );

      await db.query(
        `UPDATE users
         SET total_spent = GREATEST(total_spent - $1, 0)
         WHERE id = $2`,
        [Number(escrowPayment.amount || project.budget), project.client_id]
      );
    }

    await db.query('COMMIT');
    return { processed: true, refunded: Boolean(refundId), refundId };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

// AI-based auto-matching: Match writers to projects automatically
router.post('/auto-match', roleCheck('client'), [
  body('projectId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId } = req.body;

    const projectRes = await pool.query(
      `SELECT *
       FROM projects
       WHERE id = $1
         AND client_id = $2
         AND status = 'open'`,
      [projectId, req.user.id]
    );

    const project = projectRes.rows[0];
    if (!project) {
      return res.status(404).json({ error: 'Open project not found or not yours' });
    }

    const writersRes = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         COALESCE(u.rating, 0) AS rating,
         COALESCE(u.total_projects_completed, 0) AS total_projects_completed,
         CASE
           WHEN COALESCE(u.skills::text, '[]') ILIKE $2 THEN 1
           ELSE 0
         END AS category_match
       FROM users u
       LEFT JOIN bids existing_bid
         ON existing_bid.project_id = $1
        AND existing_bid.writer_id = u.id
       WHERE u.role = 'writer'
         AND u.is_banned = false
         AND existing_bid.id IS NULL
       ORDER BY category_match DESC, COALESCE(u.rating, 0) DESC, COALESCE(u.total_projects_completed, 0) DESC
       LIMIT 5`,
      [projectId, `%${project.category || ''}%`]
    );

    const deadlineDays = project.deadline
      ? Math.max(
          1,
          Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : 7;

    const inserted = [];

    for (const writer of writersRes.rows) {
      const result = await pool.query(
        `INSERT INTO bids (project_id, writer_id, amount, proposal, delivery_days, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (project_id, writer_id) DO NOTHING
         RETURNING id, writer_id, amount, delivery_days`,
        [
          projectId,
          writer.id,
          Number(project.budget) * 0.85,
          `Auto-matched project based on category "${project.category || 'general'}" and current writer performance.`,
          deadlineDays,
          'pending'
        ]
      );

      if (result.rows[0]) {
        inserted.push({
          ...result.rows[0],
          name: `${writer.first_name} ${writer.last_name}`,
          rating: writer.rating
        });

        await createNotification(
          writer.id,
          'auto_match',
          'New matched project',
          `You were automatically matched to "${project.title}".`,
          { projectId }
        );
      }
    }

    res.json({
      message: '✅ Auto-matching complete',
      matchedWriters: inserted.length,
      writers: inserted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-accept best bid based on rating and price
router.post('/auto-accept-bid', roleCheck('client'), [
  body('projectId').isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId } = req.body;

    const projectRes = await pool.query(
      `SELECT *
       FROM projects
       WHERE id = $1
         AND client_id = $2
         AND status = 'open'`,
      [projectId, req.user.id]
    );

    const project = projectRes.rows[0];
    if (!project) {
      return res.status(404).json({ error: 'Open project not found or not yours' });
    }

    const bidsRes = await pool.query(
      `SELECT b.*, u.rating, u.first_name, u.last_name
       FROM bids b
       JOIN users u ON b.writer_id = u.id
       WHERE b.project_id = $1
         AND b.status = 'pending'
       ORDER BY COALESCE(u.rating, 0) DESC, b.amount ASC, b.created_at ASC
       LIMIT 1`,
      [projectId]
    );

    const bestBid = bidsRes.rows[0];
    if (!bestBid) {
      return res.status(404).json({ error: 'No pending bids available' });
    }

    await pool.query('UPDATE bids SET status = $1 WHERE project_id = $2 AND id != $3', ['rejected', projectId, bestBid.id]);
    await pool.query('UPDATE bids SET status = $1, updated_at = NOW() WHERE id = $2', ['accepted', bestBid.id]);
    await pool.query(
      'UPDATE projects SET status = $1, assigned_writer_id = $2, updated_at = NOW() WHERE id = $3',
      ['in_progress', bestBid.writer_id, projectId]
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(bestBid.amount) * 100),
      currency: 'usd',
      metadata: {
        projectId: String(projectId),
        writerId: String(bestBid.writer_id),
        clientId: String(req.user.id)
      }
    });

    await createNotification(
      bestBid.writer_id,
      'bid_accepted',
      'Bid auto-accepted',
      `Your bid for "${project.title}" was automatically accepted.`,
      { projectId, bidId: bestBid.id }
    );

    res.json({
      message: '✅ Best bid auto-accepted',
      bidId: bestBid.id,
      writer: `${bestBid.first_name} ${bestBid.last_name}`,
      rating: bestBid.rating,
      amount: bestBid.amount,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-approve completed projects and release payment
router.post('/auto-approve-projects', roleCheck('client'), async (req, res) => {
  try {
    const projectsRes = await pool.query(
      `SELECT p.id, p.client_id, p.assigned_writer_id AS writer_id, p.title, p.budget
       FROM projects p
       WHERE p.client_id = $1
         AND p.status = 'completed'
         AND p.updated_at <= NOW() - INTERVAL '7 days'`,
      [req.user.id]
    );

    let approvalsCount = 0;
    const releasedProjects = [];

    for (const project of projectsRes.rows) {
      if (!project.writer_id) continue;

      const result = await releaseProjectFunds(project);
      if (!result.released) continue;

      approvalsCount++;
      releasedProjects.push({ projectId: project.id, writerAmount: result.writerAmount });

      await createNotification(
        project.writer_id,
        'payment_released',
        'Project payout released',
        `Funds for "${project.title}" were released automatically.`,
        { projectId: project.id }
      );
    }

    res.json({
      message: '✅ Auto-approval complete',
      projectsApproved: approvalsCount,
      paymentReleased: approvalsCount > 0,
      releasedProjects
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dynamic pricing engine - Adjust prices based on market demand
router.get('/pricing-recommendations', async (req, res) => {
  try {
    const category = req.query.category || 'general';

    const pricesRes = await pool.query(
      `SELECT
         category,
         AVG(budget) AS avg_price,
         COUNT(*) AS project_count,
         (SELECT COUNT(*) FROM users WHERE role = 'writer' AND is_banned = false) AS total_writers
       FROM projects
       WHERE category = $1
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY category`,
      [category]
    );

    const marketData = pricesRes.rows[0] || {};
    const recommendedPrice = Number(marketData.avg_price || 100);
    const demand = Number(marketData.project_count || 0);
    const supply = Number(marketData.total_writers || 1);
    const demandRatio = demand / supply;

    let priceMultiplier = 1;
    if (demandRatio > 2) priceMultiplier = 1.2;
    else if (demandRatio < 0.5) priceMultiplier = 0.8;

    const competitivePrice = Math.round(recommendedPrice * priceMultiplier);

    res.json({
      category,
      recommendedMinPrice: Math.round(competitivePrice * 0.7),
      recommendedPrice: competitivePrice,
      recommendedMaxPrice: Math.round(competitivePrice * 1.3),
      marketDemand: demandRatio > 1.5 ? 'HIGH' : demandRatio < 0.5 ? 'LOW' : 'MEDIUM',
      priceMultiplier: priceMultiplier.toFixed(2),
      note: 'Prices adjusted based on recent project demand'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate project descriptions using template
router.post('/generate-project-template', roleCheck('client'), async (req, res) => {
  try {
    const { title, category, budget, keywords } = req.body;

    const templates = {
      blog: `Project: ${title || 'Blog article'}

Requirements:
- SEO optimized with target keywords for ${keywords?.topic || 'your niche'}
- Engaging structure with clear subheadings
- Original research and actionable insights
- Approximate length: ${keywords?.wordCount || 1000} words

Deliverables:
- Final article in editable format
- Fact-checked draft
- Revision support if needed

Timeline: ${keywords?.deadline || '5-7 days'}
Budget: $${budget}`,
      copywriting: `Project: ${title || 'Conversion copy'}

Requirements:
- Persuasive copy for ${keywords?.type || 'landing page or campaign'}
- Strong headline and clear call-to-action
- Audience-aware messaging
- Multiple copy variations for testing

Deliverables:
- Final copy deck
- Suggested CTA variants
- Revision-ready editable copy

Timeline: ${keywords?.deadline || '3-5 days'}
Budget: $${budget}`,
      technical: `Project: ${title || 'Technical writing assignment'}

Requirements:
- Clear, concise explanation of ${keywords?.topic || 'the requested topic'}
- Audience: ${keywords?.audience || 'technical professionals'}
- Structured sections and implementation detail
- Accuracy review before submission

Deliverables:
- Publication-ready documentation
- Organized section outline
- Suggested diagrams or screenshots if useful

Timeline: ${keywords?.deadline || '7-10 days'}
Budget: $${budget}`,
      content: `Project: ${title || 'Content marketing project'}

Requirements:
- Original content around ${keywords?.topic || 'the requested topic'}
- Consistent brand voice
- SEO-friendly formatting
- ${keywords?.pieces || 'Multiple'} content deliverables

Deliverables:
- Final content package
- Suggested publishing order
- Revision-ready drafts

Timeline: ${keywords?.deadline || '10-14 days'}
Budget: $${budget}`
    };

    const description = templates[category] || templates.content;

    res.json({
      message: '✅ Project template generated',
      description,
      tip: 'Customize the generated copy before publishing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automated pricing for writers - Suggest competitive rates
router.get('/writer-pricing-guide/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const ratesRes = await pool.query(
      `SELECT
         AVG(b.amount) AS avg_bid,
         MIN(b.amount) AS min_bid,
         MAX(b.amount) AS max_bid,
         COUNT(*) AS total_bids,
         AVG(u.rating) AS avg_writer_rating
       FROM bids b
       JOIN projects p ON b.project_id = p.id
       JOIN users u ON b.writer_id = u.id
       WHERE p.category = $1
         AND b.status = 'accepted'
         AND b.created_at > NOW() - INTERVAL '60 days'`,
      [category]
    );

    const marketRates = ratesRes.rows[0];

    res.json({
      category,
      competitiveRates: {
        economy: Math.round(Number(marketRates?.min_bid || 30) * 0.9),
        standard: Math.round(Number(marketRates?.avg_bid || 75)),
        premium: Math.round(Number(marketRates?.max_bid || 150) * 1.1)
      },
      marketData: {
        averageBid: Math.round(Number(marketRates?.avg_bid || 0)),
        totalAcceptedBids: Number(marketRates?.total_bids || 0),
        averageWriterRating: Number(marketRates?.avg_writer_rating || 0).toFixed(1)
      },
      recommendation: `Suggested pricing for ${category} projects is based on accepted bids from the last 60 days.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automated dispute resolution - Auto-refund if no delivery within deadline
router.post('/auto-dispute-check', roleCheck('client'), [
  body('projectId').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { projectId } = req.body;
    const overdueRes = await pool.query(
      `SELECT p.id, p.client_id, p.assigned_writer_id AS writer_id, p.title, p.budget
       FROM projects p
       WHERE p.client_id = $1
         AND p.assigned_writer_id IS NOT NULL
         AND p.deadline < NOW()
         AND p.status = 'in_progress'
         AND ($2::int IS NULL OR p.id = $2)`,
      [req.user.id, projectId || null]
    );

    let processedCount = 0;
    let refundsProcessed = 0;

    for (const project of overdueRes.rows) {
      const result = await processOverdueProject(project);
      if (!result.processed) continue;

      processedCount++;
      if (result.refunded) refundsProcessed++;

      await createNotification(
        project.writer_id,
        'project_dispute',
        'Project flagged as overdue',
        `The project "${project.title}" was automatically flagged because it missed its deadline.`,
        { projectId: project.id }
      );
    }

    res.json({
      message: '✅ Auto-dispute check complete',
      projectsFlagged: processedCount,
      refundsProcessed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
