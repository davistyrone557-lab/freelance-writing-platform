import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const FROM = `Content-Forge.pro <${process.env.EMAIL_USER || 'noreply@content-forge.pro'}>`;

function baseTemplate(title, content) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; }
      .header { background: #2563eb; color: #fff; padding: 24px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; }
      .body { padding: 32px; color: #374151; line-height: 1.6; }
      .btn { display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0; }
      .footer { background: #f9fafb; padding: 16px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Content-Forge.pro</h1></div>
      <div class="body">
        <h2>${title}</h2>
        ${content}
      </div>
      <div class="footer">&copy; 2025 Content-Forge.pro &mdash; The Professional Writing Marketplace</div>
    </div>
  </body>
  </html>`;
}

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.EMAIL_USER) {
      console.log(`[Email] Would send "${subject}" to ${to}`);
      return;
    }
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[Email] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send email:', err.message);
  }
}

export const emailService = {
  async sendWelcome(user) {
    const html = baseTemplate('Welcome to Content-Forge.pro!', `
      <p>Hi ${user.first_name},</p>
      <p>Welcome to <strong>Content-Forge.pro</strong> — the professional marketplace connecting talented writers with clients who need great content.</p>
      <p>Your account has been created as a <strong>${user.role}</strong>.</p>
      <a href="${process.env.CLIENT_URL}/dashboard" class="btn">Go to Dashboard</a>
      <p>If you have any questions, reply to this email and we'll be happy to help!</p>
    `);
    await sendEmail(user.email, 'Welcome to Content-Forge.pro!', html);
  },

  async sendEmailVerification(user, token) {
    const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    const html = baseTemplate('Verify Your Email Address', `
      <p>Hi ${user.first_name},</p>
      <p>Please verify your email address to activate your account.</p>
      <a href="${link}" class="btn">Verify Email</a>
      <p>This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    `);
    await sendEmail(user.email, 'Verify Your Email — Content-Forge.pro', html);
  },

  async sendPasswordReset(user, token) {
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    const html = baseTemplate('Reset Your Password', `
      <p>Hi ${user.first_name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new password.</p>
      <a href="${link}" class="btn">Reset Password</a>
      <p>This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    `);
    await sendEmail(user.email, 'Password Reset — Content-Forge.pro', html);
  },

  async sendBidReceived(clientEmail, clientName, projectTitle, writerName, bidAmount) {
    const html = baseTemplate('New Bid Received', `
      <p>Hi ${clientName},</p>
      <p>You received a new bid on your project <strong>"${projectTitle}"</strong>.</p>
      <p><strong>${writerName}</strong> placed a bid of <strong>$${bidAmount}</strong>.</p>
      <a href="${process.env.CLIENT_URL}/dashboard" class="btn">Review Bids</a>
    `);
    await sendEmail(clientEmail, `New Bid on "${projectTitle}" — Content-Forge.pro`, html);
  },

  async sendBidAccepted(writerEmail, writerName, projectTitle, amount) {
    const html = baseTemplate('Your Bid Was Accepted! 🎉', `
      <p>Hi ${writerName},</p>
      <p>Congratulations! Your bid on <strong>"${projectTitle}"</strong> has been accepted.</p>
      <p>You will earn <strong>$${amount}</strong> upon completion.</p>
      <a href="${process.env.CLIENT_URL}/dashboard" class="btn">View Project</a>
    `);
    await sendEmail(writerEmail, `Bid Accepted: "${projectTitle}" — Content-Forge.pro`, html);
  },

  async sendPaymentConfirmation(userEmail, userName, amount, projectTitle) {
    const html = baseTemplate('Payment Confirmed', `
      <p>Hi ${userName},</p>
      <p>Your payment of <strong>$${amount}</strong> for <strong>"${projectTitle}"</strong> has been confirmed.</p>
      <p>Funds are held in escrow and will be released when the project is completed.</p>
      <a href="${process.env.CLIENT_URL}/dashboard" class="btn">View Project</a>
    `);
    await sendEmail(userEmail, 'Payment Confirmed — Content-Forge.pro', html);
  },

  async sendProjectCompleted(email, name, projectTitle, earnings) {
    const html = baseTemplate('Project Completed — Payment Released', `
      <p>Hi ${name},</p>
      <p>The project <strong>"${projectTitle}"</strong> has been marked as completed.</p>
      <p><strong>$${earnings}</strong> has been added to your wallet.</p>
      <a href="${process.env.CLIENT_URL}/dashboard" class="btn">View Earnings</a>
    `);
    await sendEmail(email, 'Payment Released — Content-Forge.pro', html);
  },

  async sendNewMessage(email, name, senderName) {
    const html = baseTemplate('New Message', `
      <p>Hi ${name},</p>
      <p>You have a new message from <strong>${senderName}</strong> on Content-Forge.pro.</p>
      <a href="${process.env.CLIENT_URL}/messages" class="btn">Read Message</a>
    `);
    await sendEmail(email, `New message from ${senderName} — Content-Forge.pro`, html);
  }
};

export default emailService;
