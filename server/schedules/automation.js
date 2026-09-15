import cron from 'node-cron';
import pool from '../config/database.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
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
      return false;
    }

    const escrowPayment = await db.query(
      `SELECT *
       FROM payments
       WHERE project_id = $1
         AND user_id = $2
         AND type IN ('payment', 'deposit')
         AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [project.id, project.client_id]
    );

    if (escrowPayment.rows.length === 0) {
      await db.query('ROLLBACK');
      return false;
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
        'Scheduled project payout release'
      ]
    );

    await db.query('COMMIT');
    return true;
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

  if (existingDispute.rows.length > 0) return false;

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

  if (existingRefund.rows.length > 0) return false;

  const escrowPaymentResult = await pool.query(
    `SELECT *
     FROM payments
     WHERE project_id = $1
       AND user_id = $2
       AND type IN ('payment', 'deposit')
       AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [project.id, project.client_id]
  );

  const escrowPayment = escrowPaymentResult.rows[0];
  let refundId = null;

  if (escrowPayment?.stripe_transaction_id) {
    const refund = await stripe.refunds.create({
      payment_intent: escrowPayment.stripe_transaction_id,
      amount: Math.round(Number(escrowPayment.amount || project.budget) * 100),
      reason: 'requested_by_customer',
      metadata: { projectId: String(project.id) }
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
          'Scheduled refund for overdue project'
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
    return true;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

// Initialize automated tasks
export function startAutomationSchedules() {
  console.log('🤖 Starting automated task scheduler...');

  // Auto-release funds for completed projects every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running: Auto-release completed project payments');

    try {
      const projectsRes = await pool.query(
        `SELECT id, client_id, assigned_writer_id AS writer_id, title, budget
         FROM projects
         WHERE status = 'completed'
           AND assigned_writer_id IS NOT NULL
           AND updated_at <= NOW() - INTERVAL '7 days'`
      );

      let releasedCount = 0;

      for (const project of projectsRes.rows) {
        const released = await releaseProjectFunds(project);
        if (!released) continue;

        releasedCount++;
        await createNotification(
          project.writer_id,
          'payment_released',
          'Scheduled payout released',
          `Funds for "${project.title}" were released automatically.`,
          { projectId: project.id }
        );
      }

      console.log(`✅ Released funds for ${releasedCount} completed projects`);
    } catch (error) {
      console.error('Error in auto-release task:', error);
    }
  });

  // Auto-refund overdue projects every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running: Auto-refund overdue projects');

    try {
      const overdueRes = await pool.query(
        `SELECT id, client_id, assigned_writer_id AS writer_id, title, budget
         FROM projects
         WHERE assigned_writer_id IS NOT NULL
           AND deadline < NOW()
           AND status = 'in_progress'`
      );

      let processedCount = 0;

      for (const project of overdueRes.rows) {
        const processed = await processOverdueProject(project);
        if (!processed) continue;

        processedCount++;
        await createNotification(
          project.writer_id,
          'project_dispute',
          'Project flagged as overdue',
          `The project "${project.title}" was automatically flagged because it missed its deadline.`,
          { projectId: project.id }
        );
      }

      console.log(`✅ Processed ${processedCount} overdue projects`);
    } catch (error) {
      console.error('Error in auto-refund task:', error);
    }
  });

  // Clean up inactive projects (no bids after 30 days)
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running: Clean up inactive projects');

    try {
      const inactiveRes = await pool.query(
        `SELECT id
         FROM projects
         WHERE status = 'open'
           AND created_at <= NOW() - INTERVAL '30 days'
           AND id NOT IN (SELECT DISTINCT project_id FROM bids)`
      );

      for (const project of inactiveRes.rows) {
        await pool.query(
          'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
          ['cancelled', project.id]
        );
      }

      console.log(`✅ Closed ${inactiveRes.rows.length} inactive projects`);
    } catch (error) {
      console.error('Error in cleanup task:', error);
    }
  });

  // Auto-calculate writer ratings based on project outcomes
  cron.schedule('0 1 * * *', async () => {
    console.log('⏰ Running: Update writer ratings');

    try {
      const writersRes = await pool.query(`
        SELECT DISTINCT u.id
        FROM users u
        WHERE u.role = 'writer'
      `);

      for (const writer of writersRes.rows) {
        const statsRes = await pool.query(
          `SELECT
             COUNT(CASE WHEN b.status = 'accepted' THEN 1 END)::float AS completed,
             COUNT(CASE WHEN b.status = 'rejected' THEN 1 END)::float AS rejected
           FROM bids b
           WHERE b.writer_id = $1`,
          [writer.id]
        );

        const stats = statsRes.rows[0];
        const completed = Number(stats.completed || 0);
        const rejected = Number(stats.rejected || 0);
        const total = completed + rejected;
        const completionRate = total > 0 ? completed / total : 0;
        const newRating = Math.min(5, Math.max(0, Number((completionRate * 5).toFixed(2))));

        await pool.query(
          'UPDATE users SET rating = $1 WHERE id = $2',
          [newRating, writer.id]
        );
      }

      console.log(`✅ Updated ratings for ${writersRes.rows.length} writers`);
    } catch (error) {
      console.error('Error in rating update task:', error);
    }
  });

  console.log('✅ Automation schedules started successfully');
}

export default startAutomationSchedules;
