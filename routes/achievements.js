const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
var _ = require('lodash');
const path = require('path');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();
const defaultAchievements = require('../data/default_achievements');



router.post('/set-default-achievements', requireAuth, async (req, res) => {
    try {
        const { courseId, templateIds } = req.body;

        const db = getDatabase();
        const courseAdminsCollection = db.collection('course-admins');
        const courseAdmin = await courseAdminsCollection.findOne({ courseId: new ObjectId(courseId), userId: new ObjectId(req.user._id) });

        if (req.user.admin !== 'super-admin' && !courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to set default achievements' });
        }
        
        const activeDefaultCourseAchievementsCollection = db.collection('active-default-course-achievements');
        const result = await activeDefaultCourseAchievementsCollection.updateOne(
            { courseId: new ObjectId(courseId) }, 
            { $set: { courseId: new ObjectId(courseId), templateIds: templateIds, createdAt: new Date(), createdBy: new ObjectId(req.user._id) } },
            { upsert: true, returnDocument: 'after' }
        );

        console.log('result', result);
        
        res.status(200).json({ message: 'Default achievements set successfully' });
    
    } catch (e) {
        console.error('Error setting default achievements:', e);
        res.status(500).json({ message: 'Failed to set default achievements' });
    }
});



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
        const courseAdmin = await courseAdminsCollection.findOne({ courseId: new ObjectId(achievement.courseId) });
        if (!courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to create achievements for this course' });
        }

        // check so there is no achievement with the same attributes on the same course
        // the name is the only attribute that can be the same
        const achievementsCollection = db.collection('achievements');

        const courseIdObject = new ObjectId(achievement.courseId);

        // check so there is no default achievement with the same attributes on the same course
        const activeDefaultCourseAchievementsCollection = db.collection('active-default-course-achievements');
        const defaultAchievementsForCourse = defaultAchievements;


        const existingAchievements = await achievementsCollection.find({ courseId: courseIdObject }).toArray();

        const new_achievement_for_comparison = {...achievement};

        delete new_achievement_for_comparison._id;
        delete new_achievement_for_comparison.courseId;
        delete new_achievement_for_comparison.description;
        delete new_achievement_for_comparison.title;
        delete new_achievement_for_comparison.createdAt;
        delete new_achievement_for_comparison.createdBy;
        delete new_achievement_for_comparison.updatedAt;
        delete new_achievement_for_comparison.updatedBy;

        const normalizeAchievementForComparison = (ach) => {
            const achi_copy = { ...ach };
            delete achi_copy._id;
            delete achi_copy.id;
            delete achi_copy.courseId;
            delete achi_copy.description;
            delete achi_copy.title;
            delete achi_copy.createdAt;
            delete achi_copy.createdBy;
            delete achi_copy.updatedAt;
            delete achi_copy.updatedBy;
            return achi_copy;
        };

        let refuseToCreateAchievement = false;
        let matchedDefaultTemplateId = null;

        console.log('new_achievement_for_comparison', new_achievement_for_comparison);
        console.log('existingAchievements', existingAchievements.length);

        existingAchievements.forEach(achi => {
            const achi_copy = normalizeAchievementForComparison(achi);
            console.log('achi_copy', achi_copy);
            const areAchievementsSame = _.isEqual(new_achievement_for_comparison, achi_copy);
            if (areAchievementsSame) {
                console.log('Achievement with the same attributes already exists for this course');
                refuseToCreateAchievement = true;
            }
        });

        if (refuseToCreateAchievement) {
            return res.status(400).json({ message: 'Achievement with the same attributes already exists for this course' });
        }

        defaultAchievementsForCourse.forEach(achi => {
            if (matchedDefaultTemplateId) return;
            const achi_copy = normalizeAchievementForComparison(achi);
            console.log('achi_copy', achi_copy);
            const areAchievementsSame = _.isEqual(new_achievement_for_comparison, achi_copy);
            if (areAchievementsSame) {
                matchedDefaultTemplateId = achi.id;
            }
        });

        if (matchedDefaultTemplateId) {
            const userIdObject = new ObjectId(req.user._id);
            await activeDefaultCourseAchievementsCollection.updateOne(
                { courseId: courseIdObject },
                {
                    $setOnInsert: {
                        courseId: courseIdObject,
                        createdAt: new Date(),
                        createdBy: userIdObject
                    },
                    $set: {
                        updatedAt: new Date(),
                        updatedBy: userIdObject
                    },
                    $addToSet: {
                        templateIds: matchedDefaultTemplateId
                    }
                },
                { upsert: true }
            );

            return res.status(200).json({
                message: 'Matched default achievement activated for this course',
                templateId: matchedDefaultTemplateId
            });
        }

        achievement.createdAt = new Date();
        achievement.createdBy = req.user._id;
        achievement.courseId = courseIdObject;

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