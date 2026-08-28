import express from 'express';
import Stripe from 'stripe';
import pool from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent (for clients paying writers)
router.post('/intent', verifyToken, async (req, res) => {
  try {
    const { amount, projectId, description } = req.body;

    if (!amount || amount < 5) {
      return res.status(400).json({ error: 'Minimum payment is $5' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user.id,
        projectId: projectId,
        description: description
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      intentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
router.post('/confirm', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId, projectId, writerId, amount } = req.body;

    // Verify payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Calculate platform fee (10%)
    const platformFee = amount * 0.10;
    const writerAmount = amount - platformFee;

    // Record payment in database
    await pool.query(
      'INSERT INTO payments (user_id, amount, type, status, stripe_transaction_id, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, amount, 'payment', 'completed', paymentIntentId, `Payment for project ${projectId}`]
    );

    // Add funds to writer's wallet
    await pool.query(
      'UPDATE users SET total_earned = total_earned + $1 WHERE id = $2',
      [writerAmount, writerId]
    );

    // Update client's spending
    await pool.query(
      'UPDATE users SET total_spent = total_spent + $1 WHERE id = $2',
      [amount, req.user.id]
    );

    res.json({
      message: '✅ Payment confirmed',
      amount: amount,
      writerReceives: writerAmount,
      platformFee: platformFee,
      transactionId: paymentIntentId
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request withdrawal to bank account
router.post('/withdraw', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    // Get user details
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    if (!user.stripe_account_id) {
      return res.status(400).json({ 
        error: 'Please connect your bank account first',
        instruction: 'Visit settings to add your bank account details'
      });
    }

    const minimumWithdrawal = parseFloat(process.env.MINIMUM_WITHDRAWAL || 50);
    if (amount < minimumWithdrawal) {
      return res.status(400).json({ 
        error: `Minimum withdrawal is $${minimumWithdrawal}` 
      });
    }

    if (user.total_earned < amount) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        available: user.total_earned
      });
    }

    // Create payout
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: user.stripe_account_id,
    }, {
      stripeAccount: process.env.STRIPE_SECRET_KEY
    });

    // Record withdrawal request
    await pool.query(
      'INSERT INTO payments (user_id, amount, type, status, stripe_transaction_id, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, amount, 'withdrawal', 'pending', payout.id, 'Bank transfer withdrawal']
    );

    // Reduce user's balance
    await pool.query(
      'UPDATE users SET total_earned = total_earned - $1 WHERE id = $2',
      [amount, req.user.id]
    );

    res.json({
      message: '✅ Withdrawal initiated',
      amount: amount,
      status: 'pending',
      estimatedTime: '1-3 business days',
      payoutId: payout.id
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    res.json({
      payments: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect Stripe account (for writers)
router.post('/connect-account', verifyToken, async (req, res) => {
  try {
    const { bankAccountToken } = req.body;

    if (!bankAccountToken) {
      return res.status(400).json({ error: 'Bank account token required' });
    }

    // Create Stripe connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: (await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id])).rows[0].email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      external_account: bankAccountToken
    });

    // Save Stripe account ID to user
    await pool.query(
      'UPDATE users SET stripe_account_id = $1 WHERE id = $2',
      [account.id, req.user.id]
    );

    res.json({
      message: '✅ Bank account connected',
      accountId: account.id,
      status: account.requirements?.current_deadline ? 'Pending verification' : 'Active'
    });
  } catch (error) {
    console.error('Connect account error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get account balance
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT total_earned FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    res.json({
      balance: user.total_earned,
      currency: 'USD',
      available_for_withdrawal: user.total_earned - (parseFloat(process.env.MINIMUM_WITHDRAWAL || 50))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
