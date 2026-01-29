// lib/emailVerification.js - Email verification utility
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email transporter - configured via environment variables
let transporter = null;

// Initialize email transporter
const initTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '587');
  const isSecurePort = port === 465;
  
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: isSecurePort || process.env.SMTP_SECURE === 'true', // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: !isSecurePort && port === 587, // Require STARTTLS for port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };
  
  // Add TLS options if needed (for self-signed certificates, set SMTP_REJECT_UNAUTHORIZED=false)
  if (process.env.SMTP_REJECT_UNAUTHORIZED === 'false') {
    emailConfig.tls = {
      rejectUnauthorized: false
    };
  }

  // Validate required email config
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️  Email verification not configured. Set SMTP_USER and SMTP_PASSWORD in .env');
    return null;
  }

  try {
    return nodemailer.createTransport(emailConfig);
  } catch (error) {
    console.error('Failed to initialize email transporter:', error);
    return null;
  }
};

// Initialize on module load
transporter = initTransporter();

/**
 * Generate a secure verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get the base URL for verification links
 */
const getBaseUrl = () => {
  // In production, use environment variable or construct from request
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  // Default to localhost for development
  return process.env.PORT 
    ? `http://localhost:${process.env.PORT}`
    : 'http://localhost:5000';
};

/**
 * Create HTML email template for verification
 */
const createVerificationEmailHTML = (verificationLink, username) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .email-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          padding: 30px 20px;
          text-align: center;
        }
        .email-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .email-body {
          padding: 40px 30px;
        }
        .email-body p {
          margin: 0 0 20px 0;
          font-size: 16px;
          color: #555555;
        }
        .verification-button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          text-align: center;
        }
        .verification-button:hover {
          opacity: 0.9;
        }
        .verification-link {
          word-break: break-all;
          color: #667eea;
          font-size: 14px;
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
        }
        .email-footer {
          padding: 20px 30px;
          background-color: #f8f9fa;
          text-align: center;
          font-size: 12px;
          color: #888888;
        }
        .email-footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="email-body">
          <p>Hi ${username || 'there'},</p>
          <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${verificationLink}" class="verification-button">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <div class="verification-link">${verificationLink}</div>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="email-footer">
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Create plain text email for verification
 */
const createVerificationEmailText = (verificationLink, username) => {
  return `
Hi ${username || 'there'},

Thank you for registering! Please verify your email address by visiting the following link:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

This is an automated message, please do not reply.
  `.trim();
};

/**
 * Send verification email
 * @param {string} email - Recipient email address
 * @param {string} token - Verification token
 * @param {string} username - User's username
 * @param {string} baseUrl - Base URL for the verification link (optional)
 */
const sendVerificationEmail = async (email, token, username, baseUrl = null) => {
  if (!transporter) {
    console.warn('⚠️  Email transporter not initialized. Cannot send verification email.');
    return false;
  }

  const url = baseUrl || getBaseUrl();
  const verificationLink = `${url}/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Chain Out'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email Address',
    text: createVerificationEmailText(verificationLink, username),
    html: createVerificationEmailHTML(verificationLink, username),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return false;
  }
};

/**
 * Create plain text email for password reset
 */
const createPasswordResetEmailText = (resetLink) => {
  return `
We received a request to reset the password for your ChainOut account.

Click the link below to choose a new password:
[Reset password]
${resetLink}

This link is valid for a limited time and can only be used once.

If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.

If you need any help, feel free to reach out to us.

Best regards,
The ChainOut Team
  `.trim();
};

/**
 * Create HTML email template for password reset
 */
const createPasswordResetEmailHTML = (resetLink) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .email-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          padding: 30px 20px;
          text-align: center;
        }
        .email-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .email-body {
          padding: 40px 30px;
        }
        .email-body p {
          margin: 0 0 20px 0;
          font-size: 16px;
          color: #555555;
        }
        .reset-button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          text-align: center;
        }
        .reset-button:hover {
          opacity: 0.9;
        }
        .reset-link {
          word-break: break-all;
          color: #667eea;
          font-size: 14px;
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 4px;
        }
        .email-footer {
          padding: 20px 30px;
          background-color: #f8f9fa;
          text-align: center;
          font-size: 12px;
          color: #888888;
        }
        .email-footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1>Reset your password</h1>
        </div>
        <div class="email-body">
          <p>We received a request to reset the password for your ChainOut account.</p>
          <p>Click the link below to choose a new password:</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="reset-button">Reset password</a>
          </div>
          <p>This link is valid for a limited time and can only be used once.</p>
          <p>If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
          <p>If you need any help, feel free to reach out to us.</p>
          <p>Best regards,<br/>The ChainOut Team</p>
          <p style="margin-top: 25px;">Or copy and paste this link into your browser:</p>
          <div class="reset-link">${resetLink}</div>
        </div>
        <div class="email-footer">
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} resetLink - Full link for password reset page
 */
const sendPasswordResetEmail = async (email, resetLink) => {
  if (!transporter) {
    console.warn('⚠️  Email transporter not initialized. Cannot send password reset email.');
    return false;
  }

  console.log('email', email);
  console.log('resetLink', resetLink);

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'ChainOut'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset your ChainOut password',
    text: createPasswordResetEmailText(resetLink),
    html: createPasswordResetEmailHTML(resetLink),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return false;
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  getBaseUrl,
  sendPasswordResetEmail,
};
