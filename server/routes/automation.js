import express from 'express';
import Stripe from 'stripe';
import pool from '../config/database.js';
import { verifyToken, roleCheck } from '../middleware/auth.js';
import { generalRateLimit } from '../middleware/rateLimit.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
router.use(generalRateLimit);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// AI-based auto-matching: Match writers to projects automatically
router.post('/auto-match', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.body;

    // Get project details
    const projectRes = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    const project = projectRes.rows[0];

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find top 5 writers matching project category with high ratings
    const writersRes = await pool.query(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM bids WHERE writer_id = u.id AND status = 'accepted') as completed_projects,
        AVG(CASE WHEN b.status = 'accepted' THEN u.rating ELSE NULL END) as avg_rating
      FROM users u
      LEFT JOIN bids b ON u.id = b.writer_id
      WHERE u.role = 'writer' 
      AND u.rating >= 4.0
      AND u.total_earned > 0
      ORDER BY u.rating DESC, completed_projects DESC
      LIMIT 5
    `);

    const topWriters = writersRes.rows;

    // Auto-send proposals to top writers
    for (const writer of topWriters) {
      await pool.query(
        'INSERT INTO bids (project_id, writer_id, amount, proposal, timeline, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          projectId,
          writer.id,
          project.budget * 0.85, // Competitive price: 85% of budget
          `Auto-matched project based on your expertise and ratings. Budget: $${project.budget}. Your price: $${(project.budget * 0.85).toFixed(2)}`,
          '5-7 days',
          'pending'
        ]
      );
    }

    res.json({
      message: '✅ Auto-matching complete',
      matchedWriters: topWriters.length,
      writers: topWriters.map(w => ({ id: w.id, name: `${w.first_name} ${w.last_name}`, rating: w.rating }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-accept best bid based on rating and price
router.post('/auto-accept-bid', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const { projectId } = req.body;

    // Get all bids for project, ordered by rating and price
    const bidsRes = await pool.query(`
      SELECT b.*, u.rating, u.first_name, u.last_name
      FROM bids b
      JOIN users u ON b.writer_id = u.id
      WHERE b.project_id = $1
      ORDER BY u.rating DESC, b.amount ASC
      LIMIT 1
    `, [projectId]);

    const bestBid = bidsRes.rows[0];

    if (!bestBid) {
      return res.status(404).json({ error: 'No bids available' });
    }

    // Accept the best bid
    await pool.query(
      'UPDATE bids SET status = $1 WHERE id = $2',
      ['accepted', bestBid.id]
    );

    // Reject other bids
    await pool.query(
      'UPDATE bids SET status = $1 WHERE project_id = $2 AND id != $3',
      ['rejected', projectId, bestBid.id]
    );

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(bestBid.amount * 100),
      currency: 'usd',
      metadata: {
        projectId: projectId,
        writerId: bestBid.writer_id
      }
    });

    res.json({
      message: '✅ Best bid auto-accepted',
      writer: `${bestBid.first_name} ${bestBid.last_name}`,
      rating: bestBid.rating,
      amount: bestBid.amount,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-approve completed projects and release payment
router.post('/auto-approve-projects', verifyToken, async (req, res) => {
  try {
    // Find projects with submitted work (status = 'completed')
    const projectsRes = await pool.query(`
      SELECT p.*, b.writer_id
      FROM projects p
      JOIN bids b ON p.id = b.project_id
      WHERE p.status = 'completed' AND b.status = 'accepted'
      AND p.updated_at <= NOW() - INTERVAL '7 days'
    `);

    const projects = projectsRes.rows;
    let approvalsCount = 0;

    for (const project of projects) {
      // Auto-approve if no disputes after 7 days
      await pool.query(
        'UPDATE projects SET status = $1 WHERE id = $2',
        ['approved', project.id]
      );

      // Release payment to writer
      const platformFee = project.budget * 0.10;
      const writerAmount = project.budget - platformFee;

      await pool.query(
        'UPDATE users SET total_earned = total_earned + $1 WHERE id = $2',
        [writerAmount, project.writer_id]
      );

      approvalsCount++;
    }

    res.json({
      message: '✅ Auto-approval complete',
      projectsApproved: approvalsCount,
      paymentReleased: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dynamic pricing engine - Adjust prices based on market demand
router.get('/pricing-recommendations', async (req, res) => {
  try {
    const category = req.query.category || 'general';

    // Get average project prices by category
    const pricesRes = await pool.query(`
      SELECT 
        category,
        AVG(budget) as avg_price,
        COUNT(*) as project_count,
        (SELECT COUNT(*) FROM users WHERE role = 'writer') as total_writers
      FROM projects
      WHERE category = $1 AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY category
    `, [category]);

    const marketData = pricesRes.rows[0] || {};

    // Calculate competitive prices
    const recommendedPrice = marketData.avg_price || 100;
    const demand = marketData.project_count || 0;
    const supply = marketData.total_writers || 1;
    const demandRatio = demand / supply;

    // Dynamic pricing: Adjust based on supply/demand
    let priceMultiplier = 1;
    if (demandRatio > 2) priceMultiplier = 1.2; // High demand, increase price
    else if (demandRatio < 0.5) priceMultiplier = 0.8; // Low demand, decrease price

    const competitivePrice = Math.round(recommendedPrice * priceMultiplier);

    res.json({
      category: category,
      recommendedMinPrice: Math.round(competitivePrice * 0.7),
      recommendedPrice: competitivePrice,
      recommendedMaxPrice: Math.round(competitivePrice * 1.3),
      marketDemand: demandRatio > 1.5 ? 'HIGH' : demandRatio < 0.5 ? 'LOW' : 'MEDIUM',
      priceMultiplier: priceMultiplier.toFixed(2),
      note: 'Prices adjusted based on real-time market data'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate project descriptions using template
router.post('/generate-project-template', verifyToken, roleCheck('client'), async (req, res) => {
  try {
    const { title, category, budget, keywords } = req.body;

    // AI-powered templates based on category
    const templates = {
      blog: `I need a high-quality blog post (${keywords?.wordCount || 1000} words) about ${keywords?.topic || 'your niche'}. 
      
      Requirements:
      - SEO optimized with target keywords
      - Engaging, conversational tone
      - Proper formatting with subheadings
      - Original research and insights
      - Professional editing
      
      Deliverables:
      - Final article in Word/Google Docs
      - Revision rounds included
      - Publication-ready format
      
      Timeline: ${keywords?.deadline || '5-7 days'}
      Budget: $${budget}`,
      
      copywriting: `Looking for persuasive copy for ${keywords?.type || 'sales page'} that converts.
      
      Requirements:
      - Compelling headline
      - Benefit-focused messaging
      - Clear call-to-action
      - A/B testing versions
      - Mobile-optimized
      
      Deliverables:
      - 2-3 copy variations
      - Supporting messaging guide
      - Performance recommendations
      
      Timeline: ${keywords?.deadline || '3-5 days'}
      Budget: $${budget}`,
      
      technical: `Technical writing project: ${keywords?.topic || 'Documentation/Guide'}
      
      Requirements:
      - Clear, concise technical explanations
      - Step-by-step instructions
      - Screenshots/diagrams guidance
      - Audience: ${keywords?.audience || 'Technical professionals'}
      
      Deliverables:
      - Complete documentation
      - Formatted for publication
      - Reviewed and tested
      
      Timeline: ${keywords?.deadline || '7-10 days'}
      Budget: $${budget}`,
      
      content: `Content marketing project: ${keywords?.topic || 'Content series/campaign'}
      
      Requirements:
      - Original, high-quality content
      - Consistent brand voice
      - SEO-friendly structure
      - ${keywords?.pieces || '5'} pieces total
      
      Deliverables:
      - All content pieces
      - Publishing calendar
      - Promotion tips
      
      Timeline: ${keywords?.deadline || '10-14 days'}
      Budget: $${budget}`
    };

    const description = templates[category] || templates.content;

    res.json({
      message: '✅ Project template generated',
      description: description,
      tip: 'You can customize this template further before posting'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automated pricing for writers - Suggest competitive rates
router.get('/writer-pricing-guide/:category', async (req, res) => {
  try {
    const { category } = req.params;

    // Get market rates for writers in this category
    const ratesRes = await pool.query(`
      SELECT 
        AVG(b.amount) as avg_bid,
        MIN(b.amount) as min_bid,
        MAX(b.amount) as max_bid,
        COUNT(*) as total_bids,
        AVG(u.rating) as avg_writer_rating
      FROM bids b
      JOIN projects p ON b.project_id = p.id
      JOIN users u ON b.writer_id = u.id
      WHERE p.category = $1 AND b.status = 'accepted'
      AND b.created_at > NOW() - INTERVAL '60 days'
    `, [category]);

    const marketRates = ratesRes.rows[0];

    res.json({
      category: category,
      competitiveRates: {
        economy: Math.round((marketRates?.min_bid || 30) * 0.9),
        standard: Math.round(marketRates?.avg_bid || 75),
        premium: Math.round((marketRates?.max_bid || 150) * 1.1)
      },
      marketData: {
        averageBid: Math.round(marketRates?.avg_bid || 0),
        totalAcceptedBids: marketRates?.total_bids || 0,
        averageWriterRating: (marketRates?.avg_writer_rating || 0).toFixed(1)
      },
      recommendation: `Based on current market rates, consider pricing between $${Math.round((marketRates?.min_bid || 30) * 0.9)} - $${Math.round((marketRates?.max_bid || 150) * 1.1)} for ${category} projects`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automated dispute resolution - Auto-refund if no delivery within deadline
router.post('/auto-dispute-check', verifyToken, async (req, res) => {
  try {
    // Find projects past deadline with no completion
    const overdueRes = await pool.query(`
      SELECT p.*, b.writer_id, u.stripe_account_id
      FROM projects p
      JOIN bids b ON p.id = b.project_id
      WHERE b.status = 'accepted'
      AND p.deadline < NOW()
      AND p.status != 'completed'
    `);

    const overdueProjects = overdueRes.rows;
    let refundsProcessed = 0;

    for (const project of overdueProjects) {
      // Auto-refund client
      const refund = await stripe.refunds.create({
        amount: Math.round(project.budget * 100),
        metadata: {
          projectId: project.id,
          reason: 'Project not completed by deadline'
        }
      });

      // Mark project as disputed
      await pool.query(
        'UPDATE projects SET status = $1 WHERE id = $2',
        ['disputed', project.id]
      );

      // Remove disputed amount from writer's balance
      await pool.query(
        'UPDATE users SET total_earned = total_earned - $1 WHERE id = $2',
        [project.budget * 0.85, project.writer_id]
      );

      refundsProcessed++;
    }

    res.json({
      message: '✅ Auto-dispute check complete',
      refundsProcessed: refundsProcessed,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
