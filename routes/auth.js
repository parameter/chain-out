const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, query } = require('express-validator');
const { getDatabase } = require('../config/database');
const { generateVerificationToken, sendVerificationEmail, getBaseUrl } = require('../lib/emailVerification');

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

module.exports = router;