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



router.post('/update-course', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'Course id is required' });
    }

    // check if current user is the owner of the course
    const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.userId !== req.user._id) {
      return res.status(403).json({ message: 'You are not the owner of this course' });
    }

    const db = getDatabase();
    const coursesCollection = db.collection('courses');

    const result = await coursesCollection.updateOne(
      { _id: new ObjectId(courseId) },
      { $set: { saved: true } },
      { upsert: true }
    );

    res.json({ result: result.modifiedCount + result.upsertedCount });
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

    const db = getDatabase();
    const courseAdminsCollection = db.collection('course-admins');

    // upsert user id to course admins collection
    const result = await courseAdminsCollection.updateOne(
      { courseId: new ObjectId(courseId), userEmail: userEmail }, 
      { $set: { userId: new ObjectId(req.user._id) } }, 
      { upsert: true }
    );

    res.json({ result: result.modifiedCount + result.upsertedCount });
    
  } catch (e) {
    console.error('Error assigning course to user:', e);
    res.status(500).json({ message: 'Failed to assign course to user' });
  }
});



module.exports = router;