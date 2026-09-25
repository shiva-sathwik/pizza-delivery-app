const nodemailer = require('nodemailer');

/**
 * Reusable Email Service using Nodemailer
 * Supports account verification and password reset emails
 */

let customTransporter = null;

const setCustomTransporter = (transporter) => {
  customTransporter = transporter;
};

const getTransporter = () => {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;

  // If SMTP credentials are provided in environment, create a real transport
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
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

/**
 * Send Consolidated Inventory Low-Stock Alert Email
 * @param {Object} options
 * @param {Array} options.affectedItems - List of low/out-of-stock items
 * @param {string} [options.to] - Target recipient email
 * @param {boolean} [options.isTestMode] - Whether this is a manual test dispatch
 */
const sendInventoryAlertEmail = async ({ affectedItems = [], to = null, isTestMode = false }) => {
  const recipient = to || process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL || 'admin@pizzaflow.com';
  const sender = process.env.EMAIL_FROM || '"PizzaFlow" <no-reply@pizzaflow.com>';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const inventoryUrl = `${clientUrl}/admin/inventory`;

  const subjectPrefix = isTestMode ? '🚨 [TEST MODE] ' : '🚨 ';
  const subject = `${subjectPrefix}PizzaFlow Inventory Alert — ${affectedItems.length} Item(s) Require Attention`;

  // Plain text rows
  const textRows = affectedItems
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.item} (${it.category}) | Current: ${it.quantity} | Threshold: ${it.threshold} | Status: ${it.status || (it.quantity === 0 ? 'Out of Stock' : 'Low Stock')}`
    )
    .join('\n');

  const textContent = `PizzaFlow Inventory Alert\n\n` +
    `The following ${affectedItems.length} ingredient(s) have reached low stock or are depleted:\n\n` +
    `${textRows}\n\n` +
    `Please replenish stock in the Admin Console:\n${inventoryUrl}\n`;

  // HTML table rows
  const htmlRows = affectedItems
    .map((it) => {
      const isOut = it.quantity === 0;
      const statusText = isOut ? 'Out of Stock' : 'Low Stock';
      const statusBadge = isOut
        ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">⚠️ Out of Stock</span>`
        : `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">⏳ Low Stock</span>`;

      return `
        <tr style="border-bottom: 1px solid #2a3346;">
          <td style="padding: 12px 14px; font-weight: 600; color: #f8fafc;">${it.item}</td>
          <td style="padding: 12px 14px; color: #94a3b8; text-transform: capitalize;">${it.category}</td>
          <td style="padding: 12px 14px; text-align: center; font-weight: bold; color: ${isOut ? '#f87171' : '#fbbf24'};">${it.quantity}</td>
          <td style="padding: 12px 14px; text-align: center; color: #94a3b8;">${it.threshold}</td>
          <td style="padding: 12px 14px; text-align: right;">${statusBadge}</td>
        </tr>
      `;
    })
    .join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #121620; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #2a3346;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <h1 style="color: #ff6b35; margin: 0; font-size: 20px;">
          ${isTestMode ? '🚨 [TEST ALERT] ' : '🚨 '}PizzaFlow Low-Stock Notice
        </h1>
      </div>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5;">
        ${isTestMode ? 'This is a <strong>manual test alert</strong> triggered from the admin console. ' : ''}
        The automated inventory monitoring system detected <strong>${affectedItems.length} ingredient(s)</strong> that require replenishment:
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; background: rgba(22, 27, 40, 0.6); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: rgba(255, 255, 255, 0.05); color: #cbd5e1; text-align: left; border-bottom: 1px solid #2a3346;">
            <th style="padding: 10px 14px;">Ingredient</th>
            <th style="padding: 10px 14px;">Category</th>
            <th style="padding: 10px 14px; text-align: center;">Quantity</th>
            <th style="padding: 10px 14px; text-align: center;">Threshold</th>
            <th style="padding: 10px 14px; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>

      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="${inventoryUrl}" style="background: linear-gradient(135deg, #ff6b35, #f77f00); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Open Admin Inventory Console 📦
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #2a3346; margin: 20px 0;" />
      <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">
        PizzaFlow Automated Inventory Management &bull; Alert sent to ${recipient}
      </p>
    </div>
  `;

  const mailOptions = {
    from: sender,
    to: recipient,
    subject,
    text: textContent,
    html: htmlContent
  };

  const transporter = getTransporter();
  return await transporter.sendMail(mailOptions);
};

module.exports = {
  getTransporter,
  setCustomTransporter,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInventoryAlertEmail
};

