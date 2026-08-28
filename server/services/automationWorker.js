import pool from '../config/database.js';

async function notifyWritersForOpenProjects() {
  const projectsRes = await pool.query(`
    SELECT p.id, p.title, p.category, p.budget, p.client_id
    FROM projects p
    LEFT JOIN bids b ON b.project_id = p.id
    WHERE p.status = 'open'
      AND b.id IS NULL
      AND p.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 20
  `);

  let writerNotificationsSent = 0;
  let clientUpdatesSent = 0;

  for (const project of projectsRes.rows) {
    const writersRes = await pool.query(`
      SELECT id, first_name, last_name, rating
      FROM users
      WHERE role = 'writer'
        AND COALESCE(is_banned, false) = false
      ORDER BY rating DESC, total_projects_completed DESC, total_reviews DESC
      LIMIT 3
    `);

    if (writersRes.rows.length === 0) continue;

    for (const writer of writersRes.rows) {
      const notificationRes = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         SELECT $1, $2, $3, $4, $5::jsonb
         WHERE NOT EXISTS (
           SELECT 1
           FROM notifications
           WHERE user_id = $1
             AND type = $2
             AND data->>'projectId' = $6
             AND created_at >= NOW() - INTERVAL '24 hours'
         )`,
        [
          writer.id,
          'automation_market_lead',
          `New project opportunity: ${project.title}`,
          `A ${project.category || 'writing'} project is open with a budget of $${project.budget}. Submit a bid if this is a fit for your services.`,
          JSON.stringify({
            projectId: String(project.id),
            category: project.category,
            source: 'automation_worker'
          }),
          String(project.id)
        ]
      );
      writerNotificationsSent += notificationRes.rowCount;
    }

    const clientUpdateRes = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       SELECT $1, $2, $3, $4, $5::jsonb
       WHERE NOT EXISTS (
         SELECT 1
         FROM notifications
         WHERE user_id = $1
           AND type = $2
           AND data->>'projectId' = $6
           AND created_at >= NOW() - INTERVAL '24 hours'
       )`,
      [
        project.client_id,
        'automation_service_update',
        `Worker matched talent for: ${project.title}`,
        `Our automated worker highlighted your project to ${writersRes.rows.length} top writers to help you get proposals faster.`,
        JSON.stringify({
          projectId: String(project.id),
          highlightedWriterIds: writersRes.rows.map((writer) => writer.id),
          source: 'automation_worker'
        }),
        String(project.id)
      ]
    );
    clientUpdatesSent += clientUpdateRes.rowCount;
  }

  return {
    openProjectsReviewed: projectsRes.rows.length,
    writerNotificationsSent,
    clientUpdatesSent
  };
}

async function requestClientFeedback() {
  const completedProjectsRes = await pool.query(`
    SELECT p.id, p.title, p.client_id, b.writer_id
    FROM projects p
    JOIN bids b
      ON b.project_id = p.id
     AND b.status = 'accepted'
    LEFT JOIN reviews r
      ON r.project_id = p.id
     AND r.reviewer_id = p.client_id
    WHERE p.status = 'completed'
      AND p.updated_at >= NOW() - INTERVAL '14 days'
      AND r.id IS NULL
    ORDER BY p.updated_at DESC
    LIMIT 50
  `);

  let feedbackRemindersSent = 0;

  for (const project of completedProjectsRes.rows) {
    const reminderRes = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       SELECT $1, $2, $3, $4, $5::jsonb
       WHERE NOT EXISTS (
         SELECT 1
         FROM notifications
         WHERE user_id = $1
           AND type = $2
           AND data->>'projectId' = $6
           AND created_at >= NOW() - INTERVAL '72 hours'
       )`,
      [
        project.client_id,
        'automation_feedback_reminder',
        `Feedback requested: ${project.title}`,
        'Your project was completed. Share feedback to help improve matching quality and support top-performing writers.',
        JSON.stringify({
          projectId: String(project.id),
          writerId: String(project.writer_id),
          source: 'automation_worker'
        }),
        String(project.id)
      ]
    );
    feedbackRemindersSent += reminderRes.rowCount;
  }

  return {
    completedProjectsChecked: completedProjectsRes.rows.length,
    feedbackRemindersSent
  };
}

export async function runAutomationWorker() {
  const marketingResult = await notifyWritersForOpenProjects();
  const feedbackResult = await requestClientFeedback();

  return {
    status: 'ok',
    summary: {
      marketedProjects: marketingResult.openProjectsReviewed,
      writerLeadsSent: marketingResult.writerNotificationsSent,
      serviceUpdatesSent: marketingResult.clientUpdatesSent,
      completedProjectsChecked: feedbackResult.completedProjectsChecked,
      feedbackRequestsSent: feedbackResult.feedbackRemindersSent
    },
    ranAt: new Date().toISOString()
  };
}

export default runAutomationWorker;
