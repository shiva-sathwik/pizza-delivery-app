const nodemailer = require('nodemailer');

/**
 * Reusable Email Service using Nodemailer
 * Supports account verification and password reset emails
 */

const getTransporter = () => {
  // If SMTP credentials are provided in environment, create a real transport
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Development fallback: simulated transporter that logs message delivery safely
  return {
    sendMail: async (mailOptions) => {
      console.log(`[EmailService] SMTP credentials not set. Simulated email dispatch to: ${mailOptions.to}`);
      console.log(`[EmailService] Subject: ${mailOptions.subject}`);
      // Safely do not print secrets or tokens in production logs
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EmailService] (Dev Mode) Delivery simulation completed.`);
      }
      return { messageId: `mock-${Date.now()}` };
    }
  };
};

/**
 * Send Account Verification Email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - User's name
 * @param {string} options.token - Verification token
 */
const sendVerificationEmail = async ({ to, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
  const sender = process.env.EMAIL_FROM || '"PizzaFlow" <no-reply@pizzaflow.com>';

  const mailOptions = {
    from: sender,
    to,
    subject: '🍕 Verify Your PizzaFlow Account',
    text: `Hello ${name},\n\nWelcome to PizzaFlow! Please verify your email by clicking the link below:\n\n${verificationUrl}\n\nIf you did not create this account, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #121620; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #2a3346;">
        <h1 style="color: #ff6b35; margin-bottom: 8px;">🍕 Welcome to PizzaFlow</h1>
        <p style="font-size: 16px; color: #cbd5e1;">Hello <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
          Thank you for signing up. Please verify your email address to activate your account and start ordering delicious pizzas!
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background: linear-gradient(135deg, #ff6b35, #f77f00); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          Or copy and paste this link into your browser:<br/>
          <a href="${verificationUrl}" style="color: #ff9f1c; word-break: break-all;">${verificationUrl}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #2a3346; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">
          If you didn't create a PizzaFlow account, you can safely ignore this email.
        </p>
      </div>
    `
  };

  const transporter = getTransporter();
  return await transporter.sendMail(mailOptions);
};

/**
 * Send Password Reset Email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - User's name
 * @param {string} options.token - Password reset token
 */
const sendPasswordResetEmail = async ({ to, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;
  const sender = process.env.EMAIL_FROM || '"PizzaFlow" <no-reply@pizzaflow.com>';

  const mailOptions = {
    from: sender,
    to,
    subject: '🔐 Reset Your PizzaFlow Password',
    text: `Hello ${name},\n\nYou requested a password reset for your PizzaFlow account. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #121620; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #2a3346;">
        <h1 style="color: #ff6b35; margin-bottom: 8px;">🔐 Password Reset Request</h1>
        <p style="font-size: 16px; color: #cbd5e1;">Hello <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
          We received a request to reset your PizzaFlow password. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #ff6b35, #f77f00); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          Or copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color: #ff9f1c; word-break: break-all;">${resetUrl}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #2a3346; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">
          If you did not request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    `
  };

  const transporter = getTransporter();
  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
