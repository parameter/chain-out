const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
var _ = require('lodash');
const path = require('path');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();


const checkIfAchievementsAreSame = (achievement, existingAchievements) => {
    return existingAchievements.some(a => a.name === achievement.name);
    if (achievement.description === existingAchievement.description) {
        return true;
    }
    return false;
}

router.post('/create-new-achievement', requireAuth, async (req, res) => {
    try {
        const { achievement } = req.body;

        console.log('achievement', achievement);
        console.log('req.user._id', req.user._id);

        if (!achievement) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const db = getDatabase();

        // check so user is admin för the course in course-admins 
        const courseAdminsCollection = db.collection('course-admins');
        const courseAdmin = await courseAdminsCollection.findOne({ userId: new ObjectId(req.user._id), courseId: new ObjectId(achievement.courseId) });
        if (!courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to create achievements for this course' });
        }

        // check so there is no achievement with the same attributes on the same course
        // the name is the only attribute that can be the same
        const achievementsCollection = db.collection('achievements');

        const courseIdObject = new ObjectId(achievement.courseId);

        const existingAchievements = await achievementsCollection.find({ courseId: courseIdObject }).toArray();

        existingAchievements.forEach(achi => {
            const achi_copy = {
                ...achi,
                courseId: undefined,
                id: undefined,
                description: undefined,
                title: undefined,
                createdAt: undefined,
                createdBy: undefined,
                updatedAt: undefined,
                updatedBy: undefined,
            };
            console.log('achi', achi);
            console.log('achi_copy', achi_copy);
            const areAchievementsSame = _.isEqual(achievement, achi_copy);
            if (areAchievementsSame) {
                console.log('Achievement with the same attributes already exists for this course');
                return res.status(400).json({ message: 'Achievement with the same attributes already exists for this course' });
            }
        });

        achievement.createdAt = new Date();
        achievement.createdBy = req.user._id;
        achievement.courseId = new ObjectId(achievement.courseId);

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
        const courseAdmin = await courseAdminsCollection.findOne({ userId: new ObjectId(req.user._id), courseId: new ObjectId(courseId) });
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