const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, query } = require('express-validator');
const { getDatabase } = require('../config/database');
const crypto = require('crypto');
const { generateVerificationToken, sendVerificationEmail, sendPasswordResetEmail } = require('../lib/emailVerification');

const router = express.Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('username').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;
    const db = getDatabase();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: email });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password and generate verification token
    const hashedPassword = bcrypt.hashSync(password, 10);
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Token expires in 24 hours

    // Create user with email verification fields
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      username,
      emailVerified: false,
      verificationToken: verificationToken,
      verificationTokenExpiry: tokenExpiry,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Send verification email
    const baseUrl = req.protocol + '://' + req.get('host');
    const emailSent = await sendVerificationEmail(email, verificationToken, username, baseUrl);

    if (!emailSent) {
      console.warn('User created but verification email failed to send:', email);
    }

    res.status(201).json({ 
      message: 'User created successfully. Please check your email to verify your account.',
      userId: result.insertedId,
      emailSent: emailSent
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    console.log('err', err);
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) {
      // Check if the error is due to unverified email
      
      if (info?.emailNotVerified) {
        return res.status(403).json({ 
          message: info.message || 'Please verify your email address before logging in.',
          emailNotVerified: true 
        });
      }
      return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user._id, userType: user.userType },
      process.env.JWT_SECRET || 'your-jwt-secret-change-this',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType
      }
    });
  })(req, res, next);
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out (token invalidation is client-side for JWT)' });
});

router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ 
      authenticated: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        name: req.user.name
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Email verification route
router.get('/verify-email', [
  query('token').notEmpty().withMessage('Verification token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.query;
    const db = getDatabase();
    const usersCollection = db.collection('users');

    // Find user with matching token
    const user = await usersCollection.findOne({ 
      verificationToken: token 
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    // Check if token has expired
    if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
      return res.status(400).json({ 
        message: 'Verification token has expired. Please request a new one.' 
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(200).json({ 
        message: 'Email already verified',
        verified: true
      });
    }

    // Update user to verified
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          emailVerified: true,
          updated_at: new Date()
        },
        $unset: {
          verificationToken: '',
          verificationTokenExpiry: ''
        }
      }
    );

    // Check if redirect parameter is provided (for React Native app)
    const redirectUrl = req.query.redirect;
    if (redirectUrl) {
      // Redirect to React Native app deep link
      return res.redirect(redirectUrl + '?verified=true');
    }

    // Default: return success response
    res.status(200).json({ 
      message: 'Email verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

const getPasswordResetLink = (req, token) => {
  // Prefer a client URL for the reset form if provided
  // - PASSWORD_RESET_URL: explicit URL base for reset page (recommended)
  // - CLIENT_URL: first URL entry as fallback (already used for CORS)
  // - finally: backend origin
  const passwordResetBase =
    (process.env.PASSWORD_RESET_URL && process.env.PASSWORD_RESET_URL.trim()) ||
    (process.env.CLIENT_URL && process.env.CLIENT_URL.split(',')[0]?.trim()) ||
    `${req.protocol}://${req.get('host')}`;

  // Build `${base}/reset-password?token=...` safely
  const url = new URL(passwordResetBase.replace(/\/$/, '') + '/reset-password');
  url.searchParams.set('token', token);
  return url.toString();
};

const hashOneTimeToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Request password reset (sends email if user exists)
router.post('/request-password-reset', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const db = getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });

    // Always respond success to avoid leaking whether an email exists
    if (!user) {
      return res.status(200).json({
        message: 'If an account exists for that email, a password reset link has been sent.',
      });
    }

    const rawToken = generateVerificationToken(); // 32 bytes hex
    const tokenHash = hashOneTimeToken(rawToken);

    const ttlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 60;
    const tokenExpiry = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetTokenExpiry: tokenExpiry,
          updated_at: new Date(),
        },
      }
    );

    const resetLink = getPasswordResetLink(req, rawToken);
    const emailSent = await sendPasswordResetEmail(email, resetLink);

    return res.status(200).json({
      message: 'If an account exists for that email, a password reset link has been sent.',
      emailSent,
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password using one-time token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;
    const tokenHash = hashOneTimeToken(token);

    const db = getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ passwordResetTokenHash: tokenHash });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (user.passwordResetTokenExpiry && new Date() > new Date(user.passwordResetTokenExpiry)) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    await usersCollection.updateOne(
      { _id: user._id, passwordResetTokenHash: tokenHash },
      {
        $set: {
          password: hashedPassword,
          updated_at: new Date(),
        },
        $unset: {
          passwordResetTokenHash: '',
          passwordResetTokenExpiry: '',
        },
      }
    );

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;