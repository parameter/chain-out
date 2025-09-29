const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../config/database');

const router = express.Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;
    const db = getDatabase();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: email });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      name,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({ 
      message: 'User created successfully',
      userId: result.insertedId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: info.message });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login failed' });
      }
      
      return res.json({ 
        message: 'Login successful',
        user: {
          _id: user._id,
          email: user.email,
          name: user.name
        }
      });
    });
  })(req, res, next);
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
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

module.exports = router;