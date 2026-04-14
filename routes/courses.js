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

router.post('/update-course', requireAuth, async (req, res) => {
  try {
    const { _id } = req.body;

    console.log('_id', _id);
    console.log('req.body', req.body);

    if (!_id) {
      return res.status(400).json({ message: 'Course id is required' });
    }

    // check if current user is the owner of the course in course-admins
    const db = getDatabase();
    const courseAdminsCollection = db.collection('course-admins');
    const courseAdmin = await courseAdminsCollection.findOne({ courseId: new ObjectId(_id), userId: req.user._id });
    if (!courseAdmin) {
      return res.status(403).json({ message: 'You are not authorized to update this course' });
    }

    if (req.body._id) {
      delete req.body._id;
    }

    const coursesCollection = db.collection('courses');
    const result = await coursesCollection.updateOne({ _id: new ObjectId(_id) }, { $set: req.body });

    res.json({ success: true, message: 'Course updated successfully', result: result.modifiedCount });
  } catch (e) {
    console.error('Error saving course:', e);
    res.status(500).json({ message: 'Failed to save course' });
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
    const result = await coursesCollection.insertOne(req.body);

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
    const result = await courseAdminsCollection.updateOne(
      { courseId: new ObjectId(courseId), userEmail: normalizedEmail },
      { $set: { userId: targetUser._id } },
      { upsert: true }
    );

    res.json({ result: result.modifiedCount + result.upsertedCount });
    
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