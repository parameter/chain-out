const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

router.post('/suggest-new-course', requireAuth, async (req, res) => {
    try {

      const { name, address, description, location } = req.body;

      if (!name || !address || !description || !location) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      const db = getDatabase();
      const coursesCollection = db.collection('course-applications');
      const newCourse = {
        userId: req.user._id,
        name,
        address,
        description,
        location
      };
      const result = await coursesCollection.insertOne(newCourse);
      const course = await coursesCollection.findOne({ _id: result.insertedId });

      res.status(201).json({ course });

    } catch (e) {
      console.error('Error saving new course suggestion:', e);
      res.status(500).json({ message: 'Failed to save new course suggestion' });
    }
});



router.get('/', requireAuth, async (req, res) => {
  try {

    const { courseId } = req.query;

    if (!courseId) {
      return res.status(400).json({ message: 'Course id is required' });
    }

    const db = getDatabase();
    const coursesCollection = db.collection('courses');
    const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });

    res.json({ course });

  } catch (e) {
    console.error('Error fetching course:', e);
    res.status(500).json({ message: 'Failed to fetch course' });
  }
});

/*

router.get('/courses', requireAuth, async (req, res) => {
  try {
    
    const db = getDatabase();
    const coursesCollection = db.collection('courses');
    const courses = await coursesCollection.find({}).toArray();

    res.json({ courses });

  } catch (e) {
    console.error('Error fetching courses:', e);
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
});

*/

const saveCourseRevision = async (db, currentCourse, req, { source = 'update-course', revisionReason } = {}) => {
  const revisionsCollection = db.collection('course-revisions');
  const lastRev = await revisionsCollection
    .find({ courseId: currentCourse._id })
    .sort({ revisionNumber: -1 })
    .limit(1)
    .project({ revisionNumber: 1 })
    .next();

  const revision = {
    courseId: currentCourse._id,
    revisionNumber: (lastRev?.revisionNumber ?? 0) + 1,
    snapshot: currentCourse,
    changedBy: req.user._id,
    changedByEmail: req.user.email || null,
    changedAt: new Date(),
    source
  };
  if (revisionReason) revision.revisionReason = String(revisionReason).slice(0, 500);

  const result = await revisionsCollection.insertOne(revision);
  return { ...revision, _id: result.insertedId };
};

const isCourseAdmin = async (db, courseId, userId) => {
  const courseAdminsCollection = db.collection('course-admins');
  const courseAdmin = await courseAdminsCollection.findOne({ courseId, userId });
  return Boolean(courseAdmin);
};

router.post('/update-course', requireAuth, async (req, res) => {
  try {
    const { _id, revisionReason } = req.body;

    if (!_id) {
      return res.status(400).json({ message: 'Course id is required' });
    }
    if (!ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const courseId = new ObjectId(_id);
    const db = getDatabase();

    if (!(await isCourseAdmin(db, courseId, req.user._id))) {
      return res.status(403).json({ message: 'You are not authorized to update this course' });
    }

    const coursesCollection = db.collection('courses');
    const currentCourse = await coursesCollection.findOne({ _id: courseId });
    if (!currentCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const update = { ...req.body };
    delete update._id;
    delete update.revisionReason;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const revision = await saveCourseRevision(db, currentCourse, req, {
      source: 'update-course',
      revisionReason
    });

    const result = await coursesCollection.updateOne(
      { _id: courseId },
      { $set: { ...update, updatedAt: new Date(), updatedBy: req.user._id } }
    );

    res.json({
      success: true,
      message: 'Course updated successfully',
      result: result.modifiedCount,
      revisionId: revision._id,
      revisionNumber: revision.revisionNumber
    });
  } catch (e) {
    console.error('Error saving course:', e);
    res.status(500).json({ message: 'Failed to save course' });
  }
});



router.get('/course-revisions', requireAuth, async (req, res) => {
  try {
    const { courseId, limit, skip } = req.query;

    if (!courseId) {
      return res.status(400).json({ message: 'Course id is required' });
    }
    if (!ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const courseObjectId = new ObjectId(courseId);
    const db = getDatabase();

    if (!(await isCourseAdmin(db, courseObjectId, req.user._id)) && req.user.admin !== 'super-admin') {
      return res.status(403).json({ message: 'You are not authorized to view revisions for this course' });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedSkip = Math.max(parseInt(skip, 10) || 0, 0);

    const revisionsCollection = db.collection('course-revisions');
    const revisions = await revisionsCollection
      .find({ courseId: courseObjectId })
      .project({ snapshot: 0 })
      .sort({ revisionNumber: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit)
      .toArray();

    const total = await revisionsCollection.countDocuments({ courseId: courseObjectId });

    res.json({ revisions, total });
  } catch (e) {
    console.error('Error fetching course revisions:', e);
    res.status(500).json({ message: 'Failed to fetch course revisions' });
  }
});



router.get('/course-revision', requireAuth, async (req, res) => {
  try {
    const { revisionId } = req.query;

    if (!revisionId) {
      return res.status(400).json({ message: 'Revision id is required' });
    }
    if (!ObjectId.isValid(revisionId)) {
      return res.status(400).json({ message: 'Invalid revision id' });
    }

    const db = getDatabase();
    const revisionsCollection = db.collection('course-revisions');
    const revision = await revisionsCollection.findOne({ _id: new ObjectId(revisionId) });

    if (!revision) {
      return res.status(404).json({ message: 'Revision not found' });
    }

    if (!(await isCourseAdmin(db, revision.courseId, req.user._id)) && req.user.admin !== 'super-admin') {
      return res.status(403).json({ message: 'You are not authorized to view this revision' });
    }

    res.json({ revision });
  } catch (e) {
    console.error('Error fetching course revision:', e);
    res.status(500).json({ message: 'Failed to fetch course revision' });
  }
});



router.post('/restore-course-revision', requireAuth, async (req, res) => {
  try {
    const { revisionId, revisionReason } = req.body;

    if (!revisionId) {
      return res.status(400).json({ message: 'Revision id is required' });
    }
    if (!ObjectId.isValid(revisionId)) {
      return res.status(400).json({ message: 'Invalid revision id' });
    }

    const db = getDatabase();
    const revisionsCollection = db.collection('course-revisions');
    const revision = await revisionsCollection.findOne({ _id: new ObjectId(revisionId) });

    if (!revision) {
      return res.status(404).json({ message: 'Revision not found' });
    }

    if (!(await isCourseAdmin(db, revision.courseId, req.user._id))) {
      return res.status(403).json({ message: 'You are not authorized to restore this course' });
    }

    const coursesCollection = db.collection('courses');
    const currentCourse = await coursesCollection.findOne({ _id: revision.courseId });
    if (!currentCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const backupRevision = await saveCourseRevision(db, currentCourse, req, {
      source: 'pre-restore',
      revisionReason: revisionReason
        ? `Pre-restore backup. ${revisionReason}`
        : `Pre-restore backup before restoring revision #${revision.revisionNumber}`
    });

    const restored = { ...revision.snapshot };
    delete restored._id;
    restored.updatedAt = new Date();
    restored.updatedBy = req.user._id;
    restored.restoredFromRevisionId = revision._id;
    restored.restoredFromRevisionNumber = revision.revisionNumber;

    const result = await coursesCollection.replaceOne(
      { _id: revision.courseId },
      { _id: revision.courseId, ...restored }
    );

    res.json({
      success: true,
      message: `Restored course to revision #${revision.revisionNumber}`,
      result: result.modifiedCount,
      backupRevisionId: backupRevision._id,
      backupRevisionNumber: backupRevision.revisionNumber
    });
  } catch (e) {
    console.error('Error restoring course revision:', e);
    res.status(500).json({ message: 'Failed to restore course revision' });
  }
});



router.post('/save-new-course', requireAuth, async (req, res) => {
  try {

    // check if current user is super-admin
    if (req.user.admin !== 'super-admin') {
      return res.status(403).json({ message: 'You are not authorized to save new courses' });
    }

    const db = getDatabase();
    const coursesCollection = db.collection('courses');

    const courseObject = req.body;
    courseObject.createdAt = new Date();
    courseObject.createdBy = req.user._id;

    const result = await coursesCollection.insertOne(courseObject);

    res.json({ result: result.modifiedCount });
  } catch (e) {
    console.error('Error saving course:', e);
    res.status(500).json({ message: 'Failed to save course' });
  }
});



router.post('/assign-course-to-user', requireAuth, async (req, res) => {
  try {

    const { courseId, userEmail } = req.body;

    // check if user is super-admin 
    if (req.user.admin !== 'super-admin') {
      return res.status(403).json({ message: 'You are not authorized to assign courses to users' });
    }

    if (!courseId || !userEmail) {
      return res.status(400).json({ message: 'Course id and user email are required' });
    }

    if (!ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course id' });
    }

    const db = getDatabase();
    const courseAdminsCollection = db.collection('course-admins');
    const usersCollection = db.collection('users');
    const normalizedEmail = String(userEmail).trim().toLowerCase();

    const targetUser = await usersCollection.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (!targetUser) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    // Upsert assignment using the target user's id (the one matching userEmail)
    const result = await courseAdminsCollection.insertOne(
      { courseId: new ObjectId(courseId), userId: targetUser._id, userEmail: normalizedEmail }
    );

    res.json({ result: result.insertedId });
    
  } catch (e) {
    console.error('Error assigning course to user:', e);
    res.status(500).json({ message: 'Failed to assign course to user' });
  }
});



router.get('/course-admins', requireAuth, async (req, res) => {
  try {

    if (req.user.admin !== 'super-admin') {
      return res.status(403).json({ message: 'You are not authorized to save new courses' });
    }

    const db = getDatabase();
    const courseAdminsCollection = db.collection('course-admins');

    // Fetch course-admins and join user + course in one aggregate pipeline
    const courseAdminsWithUsers = await courseAdminsCollection.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: 1,
          courseId: 1,
          userEmail: 1,
          username: '$user.username',
          courseName: '$course.name'
        }
      }
    ]).toArray();

    res.json({ courseAdmins: courseAdminsWithUsers });
  } catch (e) {
    console.error('Error fetching course admins:', e);
    res.status(500).json({ message: 'Failed to fetch course admins' });
  }
});



router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const courseAdminsCollection = db.collection('course-admins');
    const courses = await courseAdminsCollection.aggregate([
      { $match: { userId: req.user._id } },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          courseId: 1,
          courseName: '$course.name'
        }
      }
    ]).toArray();
    res.json({ courses });
  } catch (e) {
    console.error('Error fetching my courses:', e);
    res.status(500).json({ message: 'Failed to fetch my courses' });

  }
});



module.exports = router;