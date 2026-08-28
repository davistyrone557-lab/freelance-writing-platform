import cron from 'node-cron';
import pool from '../config/database.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { runAutomationWorker } from '../services/automationWorker.js';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize automated tasks
export function startAutomationSchedules() {
  console.log('🤖 Starting automated task scheduler...');

  // Auto-approve completed projects every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running: Auto-approve completed projects');
    try {
      const projectsRes = await pool.query(`
        SELECT p.*, b.writer_id FROM projects p
        JOIN bids b ON p.id = b.project_id
        WHERE p.status = 'completed' AND b.status = 'accepted'
        AND p.updated_at <= NOW() - INTERVAL '7 days'
      `);

      for (const project of projectsRes.rows) {
        const platformFee = project.budget * 0.10;
        const writerAmount = project.budget - platformFee;

        await pool.query(
          'UPDATE projects SET status = $1 WHERE id = $2',
          ['approved', project.id]
        );

        await pool.query(
          'UPDATE users SET total_earned = total_earned + $1 WHERE id = $2',
          [writerAmount, project.writer_id]
        );
      }
      console.log(`✅ Auto-approved ${projectsRes.rows.length} projects`);
    } catch (error) {
      console.error('Error in auto-approve task:', error);
    }
  });

  // Auto-refund for overdue projects every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    console.log('⏰ Running: Auto-refund overdue projects');
    try {
      const overdueRes = await pool.query(`
        SELECT p.*, b.writer_id FROM projects p
        JOIN bids b ON p.id = b.project_id
        WHERE b.status = 'accepted'
        AND p.deadline < NOW()
        AND p.status != 'completed'
        AND p.status != 'refunded'
      `);

      for (const project of overdueRes.rows) {
        try {
          await stripe.refunds.create({
            amount: Math.round(project.budget * 100),
            metadata: { projectId: project.id }
          });

          await pool.query(
            'UPDATE projects SET status = $1 WHERE id = $2',
            ['refunded', project.id]
          );
        } catch (stripeError) {
          console.error('Stripe refund error:', stripeError);
        }
      }
      console.log(`✅ Processed ${overdueRes.rows.length} overdue projects`);
    } catch (error) {
      console.error('Error in auto-refund task:', error);
    }
  });

  // Clean up inactive projects (no bids after 30 days)
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running: Clean up inactive projects');
    try {
      const inactiveRes = await pool.query(`
        SELECT id FROM projects
        WHERE status = 'open'
        AND created_at <= NOW() - INTERVAL '30 days'
        AND id NOT IN (SELECT DISTINCT project_id FROM bids)
      `);

      for (const project of inactiveRes.rows) {
        await pool.query(
          'UPDATE projects SET status = $1 WHERE id = $2',
          ['closed', project.id]
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
        SELECT DISTINCT u.id FROM users u
        WHERE u.role = 'writer'
      `);

      for (const writer of writersRes.rows) {
        const statsRes = await pool.query(`
          SELECT 
            COUNT(CASE WHEN b.status = 'accepted' THEN 1 END)::float as completed,
            COUNT(CASE WHEN b.status = 'rejected' THEN 1 END)::float as rejected,
            AVG(u.rating) as current_rating
          FROM bids b
          JOIN users u ON b.writer_id = u.id
          WHERE b.writer_id = $1
        `, [writer.id]);

        const stats = statsRes.rows[0];
        const completionRate = stats.completed / (stats.completed + stats.rejected);
        const newRating = Math.min(5, Math.max(0, (completionRate * 5).toFixed(2)));

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

  // Automated worker: market opportunities, perform matching support, and request feedback
  cron.schedule('0 */2 * * *', async () => {
    console.log('⏰ Running: Automated worker');
    try {
      const result = await runAutomationWorker();
      console.log('✅ Automated worker completed:', result.summary);
    } catch (error) {
      console.error('Error in automated worker task:', error);
    }
  });

  console.log('✅ Automation schedules started successfully');
}

export default startAutomationSchedules;
