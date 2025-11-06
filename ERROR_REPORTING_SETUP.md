# Bug Reporting Setup Guide

This application includes a manual bug reporting system that sends email notifications when you call the `reportBug()` function.

## Usage

Import and use the `reportBug()` function in your code:

```javascript
const { reportBug } = require('./lib/errorReporter');

// Simple usage
reportBug(new Error('Something went wrong'));

// With context
reportBug(error, {
  description: 'Failed to process payment',
  userId: '123',
  url: '/api/payment',
  extra: { orderId: '456', amount: 100 }
});

// In Express route
try {
  // some code
} catch (error) {
  reportBug(error, {
    description: 'Error processing user request',
    url: req.originalUrl,
    method: req.method,
    userId: req.user?._id,
    ip: req.ip
  });
  res.status(500).json({ message: 'Internal server error' });
}
```

## Configuration

Add the following environment variables to your `.env` file:

```env
# Enable error reporting
ERROR_REPORTING_ENABLED=true

# Email address to receive error reports
ERROR_REPORT_EMAIL=your-email@example.com

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Gmail Setup

If you're using Gmail:

1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Generate an "App Password" (not your regular password)
4. Use the App Password as `SMTP_PASSWORD`

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

## Features

- **Manual Control**: You decide when to report bugs by calling `reportBug()`
- **Email Notifications**: Receive detailed bug reports via email
- **Rate Limiting**: Prevents email spam (max 3 reports per 5 minutes for same error)
- **Rich HTML Emails**: Formatted reports with stack traces and context
- **Flexible Context**: Include any additional information you need
- **Always Logs**: Bugs are always logged to console, even if email is disabled

## Disabling Email Notifications

Set `ERROR_REPORTING_ENABLED=false` or simply don't set it. Bugs will still be logged to console, but no emails will be sent.

## Testing

To test the bug reporting system:

```javascript
const { reportBug } = require('./lib/errorReporter');

// Test bug report
reportBug(new Error('Test bug'), {
  description: 'Testing bug reporting system',
  url: '/api/test',
  method: 'GET',
  userId: 'test-user-id',
  extra: { testData: 'some value' }
});
```
