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

        // check so user is admin för the course in course-admins 
        const courseAdminsCollection = db.collection('course-admins');
        const courseAdmin = await courseAdminsCollection.findOne({ userId: req.user._id, courseId: achievement.courseId });
        if (!courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to create achievements for this course' });
        }

        achievement.createdAt = new Date();
        achievement.createdBy = req.user._id;

        const achievementsCollection = db.collection('achievements');
        const achievementResult = await achievementsCollection.insertOne(achievement);

        res.status(201).json({ achievementResult });

    } catch (error) {
        console.error('Error creating achievement:', error);
        res.status(500).json({ message: 'Failed to create achievement' });
    }
});



router.get('/get-course-achievements', requireAuth, async (req, res) => {
    try {
        const { courseId } = req.query;
        if (!courseId) {
            return res.status(400).json({ message: 'Course id is required' });
        }

        const db = getDatabase();

        // check so user is admin för the course in course-admins 
        const courseAdminsCollection = db.collection('course-admins');
        const courseAdmin = await courseAdminsCollection.findOne({ userId: req.user._id, courseId: courseId });
        if (!courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to create achievements for this course' });
        }

        
        const achievementsCollection = db.collection('achievements');
        const achievements = await achievementsCollection.find({ courseId: new ObjectId(courseId) }).toArray();
        res.status(200).json({ achievements });
    } catch (error) {
        console.error('Error getting all achievements:', error);
        res.status(500).json({ message: 'Failed to get all achievements' });
    }
});



module.exports = router;