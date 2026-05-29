const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
var _ = require('lodash');
const path = require('path');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();
const default_achievements = require('../data/default_achievements');
const ACHIEVEMENT_DIFFICULTY_XP_MAP = require('../data/achievement_difficulty_xp_map');

const ACHIEVEMENT_COMPARISON_OMIT_KEYS = [
  '_id',
  'id',
  'courseId',
  'description',
  'title',
  'reward',
  'imageName',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
];

const normalizeAchievementForComparison = (achievement) => {
  const copy = { ...achievement };
  for (const key of ACHIEVEMENT_COMPARISON_OMIT_KEYS) {
    delete copy[key];
  }
  return copy;
};

const findDuplicateAchievement = (achievement, candidates, { excludeId } = {}) => {
  const normalized = normalizeAchievementForComparison(achievement);
  const excludeIdStr = excludeId != null ? String(excludeId) : null;

  for (const candidate of candidates) {
    if (excludeIdStr) {
      const candidateId = candidate._id != null ? String(candidate._id) : null;
      if (candidateId === excludeIdStr) continue;
    }
    if (_.isEqual(normalized, normalizeAchievementForComparison(candidate))) {
      return candidate;
    }
  }

  return null;
};

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
        
        res.status(200).json({ message: 'Default achievements set successfully' });
    
    } catch (e) {
        console.error('Error setting default achievements:', e);
        res.status(500).json({ message: 'Failed to set default achievements' });
    }
});



router.post('/create-new-achievement', requireAuth, async (req, res) => {
    try {
        const { achievement, layoutId } = req.body;

        console.log('achievement', achievement);
        console.log('req.user._id', req.user._id);

        if (!achievement) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (layoutId !== undefined) {
            if (layoutId === null || layoutId === '') {
                achievement.layoutId = null;
            } else {
                achievement.layoutId = typeof layoutId === 'string' ? layoutId.trim() : layoutId;
            }
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
        const defaultAchievementsForCourse = default_achievements;


        const existingAchievements = await achievementsCollection.find({ courseId: courseIdObject }).toArray();

        let matchedDefaultTemplateId = null;

        const theMatchingAchievement = findDuplicateAchievement(
            achievement,
            [...existingAchievements, ...defaultAchievementsForCourse]
        );
        const refuseToCreateAchievement = theMatchingAchievement != null;

        // if the matching achievement is a default achievement, we need to activate it in active-default-course-achievements
        if (theMatchingAchievement && theMatchingAchievement.id.startsWith('default-')) {

            console.log('theMatchingAchievement', theMatchingAchievement);

            await activeDefaultCourseAchievementsCollection.updateOne(
                { courseId: courseIdObject },
                { $addToSet: { templateIds: theMatchingAchievement.id } },
                { upsert: true }
            );
        }

        if (refuseToCreateAchievement) {
            return res.status(400).json({ message: 'Achievement with the same attributes already exists for this course' });
        }

        if (matchedDefaultTemplateId) {
            let userIdObject = new ObjectId(req.user._id);
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



router.get('/course-achievements', requireAuth, async (req, res) => {
    try {
        const { courseId } = req.query;
        if (!courseId) {
            return res.status(400).json({ message: 'Course id is required' });
        }

        const db = getDatabase();
        const achievementsCollection = db.collection('achievements');
        const achievements = await achievementsCollection.find({ courseId: new ObjectId(courseId) }).toArray();

        const activeDefaultCourseAchievementsCollection = db.collection('active-default-course-achievements');
        const defaultAchievementsForCourse = await activeDefaultCourseAchievementsCollection.findOne({ courseId: new ObjectId(courseId) });
        const templateIds = defaultAchievementsForCourse?.templateIds;
        const defaultAchievements = defaultAchievementsForCourse
            ? default_achievements.filter((ach) => Array.isArray(templateIds) && templateIds.includes(ach.id))
            : default_achievements;

        const userAchievementsCollection = db.collection('userAchievementProgress');
        const userAchievements = await userAchievementsCollection.find({ userId: new ObjectId(req.user._id), courseId: new ObjectId(courseId) }).toArray();
        
        const allCourseAchievements = [...achievements, ...defaultAchievements];

        const userAchievementsById = new Map();
        userAchievements.forEach(ach => {
            userAchievementsById.set(ach.achievementId.toString(), ach);
        });
        
        allCourseAchievements.forEach(ach => {

            if (ach.id) {
                // for default achievements, we need to use the id
                if (userAchievementsById.has(ach.id)) {
                    ach.won = userAchievementsById.get(ach.id).won;
                    ach.completed = userAchievementsById.get(ach.id).completed;
                    ach.progress = userAchievementsById.get(ach.id).progress;
                    ach.won = userAchievementsById.get(ach.id).won;
                    return;
                }
            }
            if (ach._id) {
                // for non-default achievements, we need to use the _id
                if (userAchievementsById.has(ach._id.toString())) {
                    ach.won = userAchievementsById.get(ach._id.toString()).won;
                    ach.completed = userAchievementsById.get(ach._id.toString()).completed;
                    ach.progress = userAchievementsById.get(ach._id.toString()).progress;
                    ach.won = userAchievementsById.get(ach._id.toString()).won;
                }
            }
        });

        allCourseAchievements.forEach(ach => {
            ach.XpReward = ACHIEVEMENT_DIFFICULTY_XP_MAP[ach.difficulty];
        });

        res.status(200).json({ achievements: allCourseAchievements });

    } catch (error) {
        console.error('Error getting all achievements:', error);
        res.status(500).json({ message: 'Failed to get all achievements' });
    }
});



// for admin to get all achievements for a course
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

        const activeDefaultCourseAchievementsCollection = db.collection('active-default-course-achievements');
        const defaultAchievementsForCourse = await activeDefaultCourseAchievementsCollection.findOne({ courseId: new ObjectId(courseId) });
        const templateIds = defaultAchievementsForCourse?.templateIds ?? [];
        const defaultAchievements = default_achievements.filter((ach) => templateIds.includes(ach.id));

        res.status(200).json({ achievements: [...achievements, ...defaultAchievements] });
        
    } catch (error) {
        console.error('Error getting all achievements:', error);
        res.status(500).json({ message: 'Failed to get all achievements' });
    }
});



router.post('/update-achievement', requireAuth, async (req, res) => {
    try {
        const { achievement, layoutId } = req.body;

        if (!achievement || !achievement._id) {
            return res.status(400).json({ message: 'Achievement id is required' });
        }
        if (!ObjectId.isValid(achievement._id)) {
            return res.status(400).json({ message: 'Invalid achievement id' });
        }

        if (layoutId !== undefined) {
            if (layoutId === null || layoutId === '') {
                achievement.layoutId = null;
            } else {
                achievement.layoutId = typeof layoutId === 'string' ? layoutId.trim() : layoutId;
            }
        }

        const db = getDatabase();
        const achievementsCollection = db.collection('achievements');
        const achievementId = new ObjectId(achievement._id);

        const existingAchievement = await achievementsCollection.findOne({ _id: achievementId });
        if (!existingAchievement) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        const courseIdObject = existingAchievement.courseId;

        const courseAdminsCollection = db.collection('course-admins');
        const courseAdmin = await courseAdminsCollection.findOne({
            userId: new ObjectId(req.user._id),
            courseId: courseIdObject
        });
        if (req.user.admin !== 'super-admin' && !courseAdmin) {
            return res.status(403).json({ message: 'You are not authorized to update achievements for this course' });
        }

        const update = { ...achievement };
        delete update._id;
        delete update.createdAt;
        delete update.createdBy;
        delete update.courseId;

        const mergedAchievement = { ...existingAchievement, ...update };

        const otherAchievements = await achievementsCollection
            .find({ courseId: courseIdObject, _id: { $ne: achievementId } })
            .toArray();

        console.log('mergedAchievement', mergedAchievement);

        const duplicateAchievement = findDuplicateAchievement(
            mergedAchievement,
            [...otherAchievements, ...default_achievements]
        );

        if (duplicateAchievement) {
            return res.status(400).json({ message: 'Achievement with the same attributes already exists for this course' });
        }

        const result = await achievementsCollection.updateOne(
            { _id: achievementId },
            {
                $set: {
                    ...update,
                    updatedAt: new Date(),
                    updatedBy: new ObjectId(req.user._id)
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        res.status(200).json({ message: 'Achievement updated successfully', modifiedCount: result.modifiedCount });

    } catch (error) {
        console.error('Error updating achievement:', error);
        res.status(500).json({ message: 'Failed to update achievement' });
    }
});


// delete-achievement
router.post('/delete-achievement', requireAuth, async (req, res) => {
    try {
        const { achievementId, courseId } = req.body;
        if (!achievementId) {
            return res.status(400).json({ message: 'Achievement id is required' });
        }

        const db = getDatabase();
        const achievementsCollection = db.collection('achievements');
        const achievementIdObject = new ObjectId(achievementId);
        const achievement = await achievementsCollection.findOne({ _id: achievementIdObject });
        if (!achievement) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        const result = await achievementsCollection.deleteOne({ _id: achievementIdObject, courseId: new ObjectId(courseId) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Achievement not found' });
        }

        res.status(200).json({ message: 'Achievement deleted successfully' });

    } catch (error) {
        console.error('Error deleting achievement:', error);
        res.status(500).json({ message: 'Failed to delete achievement' });
    }
});


module.exports = router;