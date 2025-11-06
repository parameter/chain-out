// lib/errorReporter.js - Manual error reporting utility with email notifications
const nodemailer = require('nodemailer');

// Email transporter - configured via environment variables
let transporter = null;

// Initialize email transporter
const initTransporter = () => {
  // Only initialize if email is enabled
  if (process.env.ERROR_REPORTING_ENABLED !== 'true') {
    return null;
  }

  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  // Validate required email config
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️  Error reporting email not configured. Set SMTP_USER and SMTP_PASSWORD in .env');
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
 * Format error information for reporting
 */
const formatError = (error, context = {}) => {
  const timestamp = new Date().toISOString();
  
  let errorInfo = {
    timestamp,
    message: error?.message || error?.toString() || 'Unknown error',
    stack: error?.stack || (error instanceof Error ? error.toString() : 'No stack trace available'),
    name: error?.name || 'Error',
  };

  // If error is not an Error object, try to stringify it
  if (!(error instanceof Error)) {
    try {
      errorInfo.rawError = JSON.stringify(error, null, 2);
    } catch (e) {
      errorInfo.rawError = String(error);
    }
  }

  // Add additional context
  if (context.url) errorInfo.url = context.url;
  if (context.method) errorInfo.method = context.method;
  if (context.userId) errorInfo.userId = context.userId;
  if (context.ip) errorInfo.ip = context.ip;
  if (context.body) errorInfo.requestBody = context.body;
  if (context.query) errorInfo.query = context.query;
  if (context.params) errorInfo.params = context.params;
  if (context.environment) errorInfo.environment = context.environment;
  if (context.description) errorInfo.description = context.description;
  if (context.extra) errorInfo.extra = context.extra;

  // Add any additional properties from the error object
  if (error instanceof Error) {
    Object.keys(error).forEach(key => {
      if (!['message', 'stack', 'name'].includes(key)) {
        errorInfo[key] = error[key];
      }
    });
  }

  return errorInfo;
};

/**
 * Format error as HTML for email
 */
const formatErrorHTML = (errorInfo) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; color: #dc3545; margin-bottom: 10px; }
        .error-details { background: white; padding: 15px; border-left: 4px solid #dc3545; margin-top: 10px; }
        .stack-trace { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto; }
        .context-item { margin: 5px 0; }
        .label { font-weight: bold; color: #495057; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚨 Bug Report</h2>
        </div>
        <div class="content">
          <div class="section">
            <div class="section-title">Error Information</div>
            <div class="error-details">
              <div class="context-item"><span class="label">Timestamp:</span> ${errorInfo.timestamp}</div>
              <div class="context-item"><span class="label">Error Name:</span> ${errorInfo.name}</div>
              <div class="context-item"><span class="label">Error Message:</span> ${errorInfo.message}</div>
              ${errorInfo.description ? `<div class="context-item"><span class="label">Description:</span> ${errorInfo.description}</div>` : ''}
            </div>
          </div>

          ${errorInfo.url || errorInfo.method ? `
          <div class="section">
            <div class="section-title">Request Information</div>
            <div class="error-details">
              ${errorInfo.method ? `<div class="context-item"><span class="label">Method:</span> ${errorInfo.method}</div>` : ''}
              ${errorInfo.url ? `<div class="context-item"><span class="label">URL:</span> ${errorInfo.url}</div>` : ''}
              ${errorInfo.ip ? `<div class="context-item"><span class="label">IP Address:</span> ${errorInfo.ip}</div>` : ''}
              ${errorInfo.userId ? `<div class="context-item"><span class="label">User ID:</span> ${errorInfo.userId}</div>` : ''}
              ${errorInfo.query ? `<div class="context-item"><span class="label">Query:</span> <pre>${JSON.stringify(errorInfo.query, null, 2)}</pre></div>` : ''}
              ${errorInfo.params ? `<div class="context-item"><span class="label">Params:</span> <pre>${JSON.stringify(errorInfo.params, null, 2)}</pre></div>` : ''}
              ${errorInfo.requestBody ? `<div class="context-item"><span class="label">Request Body:</span> <pre>${JSON.stringify(errorInfo.requestBody, null, 2)}</pre></div>` : ''}
            </div>
          </div>
          ` : ''}

          ${errorInfo.extra ? `
          <div class="section">
            <div class="section-title">Additional Information</div>
            <div class="error-details">
              <pre>${JSON.stringify(errorInfo.extra, null, 2)}</pre>
            </div>
          </div>
          ` : ''}

          ${errorInfo.rawError ? `
          <div class="section">
            <div class="section-title">Raw Error Data</div>
            <div class="error-details">
              <pre>${errorInfo.rawError}</pre>
            </div>
          </div>
          ` : ''}

          ${errorInfo.stack ? `
          <div class="section">
            <div class="section-title">Stack Trace</div>
            <div class="stack-trace">${errorInfo.stack}</div>
          </div>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Format error as plain text for email
 */
const formatErrorText = (errorInfo) => {
  let text = `BUG REPORT\n`;
  text += `==========\n\n`;
  text += `Timestamp: ${errorInfo.timestamp}\n`;
  text += `Error Name: ${errorInfo.name}\n`;
  text += `Error Message: ${errorInfo.message}\n`;
  if (errorInfo.description) text += `Description: ${errorInfo.description}\n`;
  text += `\n`;

  if (errorInfo.url || errorInfo.method) {
    text += `REQUEST INFORMATION\n`;
    text += `-------------------\n`;
    if (errorInfo.method) text += `Method: ${errorInfo.method}\n`;
    if (errorInfo.url) text += `URL: ${errorInfo.url}\n`;
    if (errorInfo.ip) text += `IP: ${errorInfo.ip}\n`;
    if (errorInfo.userId) text += `User ID: ${errorInfo.userId}\n`;
    if (errorInfo.query) text += `Query: ${JSON.stringify(errorInfo.query, null, 2)}\n`;
    if (errorInfo.params) text += `Params: ${JSON.stringify(errorInfo.params, null, 2)}\n`;
    if (errorInfo.requestBody) text += `Body: ${JSON.stringify(errorInfo.requestBody, null, 2)}\n`;
    text += `\n`;
  }

  if (errorInfo.extra) {
    text += `ADDITIONAL INFORMATION\n`;
    text += `----------------------\n`;
    text += `${JSON.stringify(errorInfo.extra, null, 2)}\n\n`;
  }

  if (errorInfo.rawError) {
    text += `RAW ERROR DATA\n`;
    text += `---------------\n`;
    text += `${errorInfo.rawError}\n\n`;
  }

  if (errorInfo.stack) {
    text += `STACK TRACE\n`;
    text += `-----------\n`;
    text += `${errorInfo.stack}\n`;
  }

  return text;
};

/**
 * Send error report via email
 */
const sendErrorEmail = async (errorInfo) => {
  if (!transporter) {
    console.warn('⚠️  Email transporter not initialized. Skipping email notification.');
    return false;
  }

  const recipientEmail = process.env.ERROR_REPORT_EMAIL || process.env.SMTP_USER;
  
  if (!recipientEmail) {
    console.warn('⚠️  ERROR_REPORT_EMAIL not set. Skipping email notification.');
    return false;
  }

  const mailOptions = {
    from: `"Bug Reporter" <${process.env.SMTP_USER}>`,
    to: recipientEmail,
    subject: `🚨 Bug Report: ${errorInfo.message.substring(0, 50)}${errorInfo.message.length > 50 ? '...' : ''}`,
    text: formatErrorText(errorInfo),
    html: formatErrorHTML(errorInfo),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Bug report email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send bug report email:', error);
    return false;
  }
};

/**
 * Rate limiting for error reports (prevent email spam)
 */
const errorReportCache = new Map();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_REPORTS_PER_WINDOW = 3; // Max 3 reports per 5 minutes for same error

const shouldReport = (errorInfo) => {
  const errorKey = errorInfo.message.substring(0, 100); // Use first 100 chars as key
  const now = Date.now();
  
  const cached = errorReportCache.get(errorKey);
  
  if (!cached) {
    errorReportCache.set(errorKey, { count: 1, firstReport: now, lastReport: now });
    return true;
  }
  
  // Reset if window expired
  if (now - cached.firstReport > RATE_LIMIT_WINDOW) {
    errorReportCache.set(errorKey, { count: 1, firstReport: now, lastReport: now });
    return true;
  }
  
  // Check rate limit
  if (cached.count >= MAX_REPORTS_PER_WINDOW) {
    console.log(`⚠️  Rate limit reached for error: ${errorKey.substring(0, 50)}...`);
    return false;
  }
  
  // Increment count
  cached.count++;
  cached.lastReport = now;
  errorReportCache.set(errorKey, cached);
  return true;
};

/**
 * Main function to report a bug/error
 * 
 * @param {Error|string|object} error - The error to report (can be Error object, string, or any object)
 * @param {object} context - Optional context information
 * @param {string} context.description - Human-readable description of what happened
 * @param {string} context.url - URL where error occurred
 * @param {string} context.method - HTTP method
 * @param {string} context.userId - User ID
 * @param {string} context.ip - IP address
 * @param {object} context.body - Request body
 * @param {object} context.query - Query parameters
 * @param {object} context.params - Route parameters
 * @param {object} context.extra - Any additional data you want to include
 * 
 * @example
 * // Simple usage
 * reportBug(new Error('Something went wrong'));
 * 
 * @example
 * // With context
 * reportBug(error, {
 *   description: 'Failed to process payment',
 *   userId: '123',
 *   url: '/api/payment',
 *   extra: { orderId: '456', amount: 100 }
 * });
 * 
 * @example
 * // In Express route
 * try {
 *   // some code
 * } catch (error) {
 *   reportBug(error, {
 *     description: 'Error processing user request',
 *     url: req.originalUrl,
 *     method: req.method,
 *     userId: req.user?._id,
 *     ip: req.ip
 *   });
 *   res.status(500).json({ message: 'Internal server error' });
 * }
 */
const reportBug = async (error, context = {}) => {
  // Always log to console
  console.error('🐛 Bug report:', error);
  if (context.description) {
    console.error('📍 Description:', context.description);
  }

  // Convert error to Error object if needed
  let errorObj = error;

  // Support payload-style usage: reportBug({ description, data, url, method, ... })
  if (error && typeof error === 'object' && !(error instanceof Error) && !('stack' in error)) {
    const payload = error;
    const description = payload.description || payload.message || context.description || 'Manual bug report';
    errorObj = new Error(description);

    // Merge payload fields into context
    context = {
      ...context,
      description,
      url: payload.url || context.url,
      method: payload.method || context.method,
      userId: payload.userId || context.userId,
      ip: payload.ip || context.ip,
      body: payload.body || context.body,
      query: payload.query || context.query,
      params: payload.params || context.params,
      environment: payload.environment || context.environment,
      extra: payload.data || payload.extra || context.extra,
    };
  } else if (typeof error === 'string') {
    errorObj = new Error(error);
  } else if (!(error instanceof Error)) {
    errorObj = new Error(String(error));
  }

  // Format error information
  const errorInfo = formatError(errorObj, context);

  // Check rate limit before sending email
  if (process.env.ERROR_REPORTING_ENABLED === 'true' && shouldReport(errorInfo)) {
    try {
      await sendErrorEmail(errorInfo);
    } catch (emailError) {
      console.error('Failed to send bug report email:', emailError);
    }
  } else if (process.env.ERROR_REPORTING_ENABLED !== 'true') {
    console.log('ℹ️  Error reporting is disabled. Set ERROR_REPORTING_ENABLED=true to enable email notifications.');
  }

  // Return error info for potential logging to database or other services
  return errorInfo;
};

module.exports = {
  reportBug,
};
