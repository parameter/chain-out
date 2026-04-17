const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();


router.post('/create-new-achievement', requireAuth, async (req, res) => {
    try {
        const { achievement } = req.body;

        if (!achievement) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const db = getDatabase();
        const achievementsCollection = db.collection('achievements');

        const achievementResult = await achievementsCollection.insertOne(achievement);

        res.status(201).json({ achievementResult });

    } catch (error) {
        console.error('Error creating achievement:', error);
        res.status(500).json({ message: 'Failed to create achievement' });
    }
});


module.exports = router;