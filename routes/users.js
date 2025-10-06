const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const { getPresignedPutUrl, getPresignedGetUrl } = require('../utils/s3');

const router = express.Router();


/*
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
}); */

// Middleware to check authentication
// Middleware to log request headers

const requireAuth = passport.authenticate('jwt', { session: false });

router.get('/profile', requireAuth, (req, res) => {
  
  res.json({
    _id: req.user._id,
    email: req.user.email,
    name: req.user.name
  });
});




router.get('/courses', requireAuth, async (req, res) => {

  

  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ message: 'location query parameter is required (format: lat,lng)' });
    }
    const [latStr, lngStr] = location.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: 'Invalid location format. Use lat,lng' });
    }

    const db = getDatabase();
    // Ensure geolocation index exists (optional, for performance)
    // await db.collection('courses').createIndex({ "geolocation": "2dsphere" });

    // 100km in meters
    const maxDistance = 100 * 1000;

    const courses = await db.collection('courses').find({
      "location": {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: maxDistance
        }
      }
    }).toArray();

    res.json({ courses });

  } catch (err) {
    console.error('Error fetching courses by location:', err);
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
});



// Presign a PUT URL for uploading a single file
router.post('/uploads/presign', requireAuth, async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ message: 'fileName and contentType are required' });
    }
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `jobs/${req.user._id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
    const data = await getPresignedPutUrl(key, contentType, 900); // 15 min
    res.json(data); // { key, url }
  } catch (e) {
    console.error('Error presigning upload:', e);
    res.status(500).json({ message: 'Failed to presign upload' });
  }
});

router.get('/uploads/file-url', requireAuth, async (req, res) => {
  try {
    const { key, expires } = req.query;
    if (!key) return res.status(400).json({ message: 'key is required' });
    const ttl = Number(expires) || 900;
    const data = await getPresignedGetUrl(key, ttl); // { key, url }
    res.json(data);
  } catch (e) {
    console.error('Error presigning get url:', e);
    res.status(500).json({ message: 'Failed to presign file url' });
  }
});


router.post('/scorecard/invite-users', requireAuth, async (req, res) => {
  try {
    const { courseId, layoutId, invitedUserIds } = req.body;

    // Accept both a single string or an array for backward compatibility
    let userIds = [];
    if (Array.isArray(invitedUserIds)) {
      userIds = invitedUserIds.filter(Boolean);
    } else if (typeof invitedUserIds === 'string') {
      userIds = [invitedUserIds];
    } else if (req.body.invitedUserId) {
      // fallback for old clients
      userIds = [req.body.invitedUserId];
    }

    if (!courseId || !userIds.length) {
      return res.status(400).json({ message: 'courseId and at least one invitedUserId are required' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const coursesCollection = db.collection('courses');

    let scorecard = await scorecardsCollection.findOne({ courseId });

    // Prepare invite objects
    const now = new Date();
    const invites = userIds.map(uid => ({
      invitedUserId: uid,
      invitedBy: req.user._id,
      status: 'pending',
      date: now
    }));

    let scorecardId;
    let created = false;

    if (!scorecard) {
      const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
      const layout = course?.layouts?.[layoutId] || null;

      const newScorecard = {
        courseId,
        layout,
        results: [],
        invites,
        createdAt: now,
        updatedAt: now
      };
      const result = await scorecardsCollection.insertOne(newScorecard);
      scorecard = { ...newScorecard, _id: result.insertedId };
      scorecardId = result.insertedId;
      created = true;
    } else {
      // Only add users who are not already invited
      const alreadyInvitedIds = (scorecard.invites || []).map(inv => String(inv.invitedUserId));
      const newInvites = invites.filter(invite => !alreadyInvitedIds.includes(String(invite.invitedUserId)));
      if (newInvites.length > 0) {
        await scorecardsCollection.updateOne(
          { _id: scorecard._id },
          {
            $push: { invites: { $each: newInvites } },
            $set: { updatedAt: now }
          }
        );
      }
      scorecardId = scorecard._id;
    }

    res.status(201).json({
      message: userIds.length > 1 ? 'Users invited to scorecard' : 'User invited to scorecard',
      scorecardId,
      invitedUserIds: userIds,
      status: 'pending',
      date: now
    });
  } catch (e) {
    console.error('Error inviting user(s) to scorecard:', e);
    res.status(500).json({ message: 'Failed to invite user(s) to scorecard' });
  }
});

router.post('/scorecard/add-result', requireAuth, async (req, res) => {
  try {
    const { scorecardId, hole, score } = req.body;
    if (!scorecardId || typeof hole === 'undefined' || typeof score === 'undefined') {
      return res.status(400).json({ message: 'scorecardId, hole, and score are required' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const resultObj = {
      userId: req.user._id,
      hole,
      score,
      datetime: new Date()
    };

    // Combine the find and update in a single query using $elemMatch to check invite
    const updateResult = await scorecardsCollection.updateOne(
      {
        _id: new ObjectId(scorecardId),
        "invites.invitedUserId": req.user._id
      },
      { $push: { results: resultObj } }
    );

    if (updateResult.matchedCount === 0) {
      // Either scorecard not found or user not invited
      // Check which case it is for more specific error
      const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });
      if (!scorecard) {
        return res.status(404).json({ message: 'Scorecard not found' });
      }
      return res.status(403).json({ message: 'You are not invited to this scorecard' });
    }

    res.status(201).json({ message: 'Result added to scorecard', result: resultObj });

  } catch (e) {
    console.error('Error adding result to scorecard:', e);
    res.status(500).json({ message: 'Failed to add result to scorecard' });
  }
});

router.post('/find-users', requireAuth, async (req, res) => {
  const { string } = req.body;

  console.log('string', string);
  if (string) {
    console.log('string is not empty');
  }

  if (!string) {
    console.log('Search string is required');
    return res.status(400).json({ message: 'Search string is required' });
  }

  const db = getDatabase();
  const usersCollection = db.collection('users');

  const regex = new RegExp(string, 'i');
  const users = await usersCollection.find({
    $or: [
      { username: { $regex: regex } },
      { email: { $regex: regex } }
    ]
  })
  .project({ password: 0 })
  .toArray();

  console.log('users', users);

  res.json({ users });
});

router.post('/find-course', requireAuth, async (req, res) => {
  const { string } = req.body;

  if (!string || typeof string !== 'string' || !string.trim() || string.trim().length <= 4) {
    return res.status(400).json({ message: 'Search string is required and must be longer than 4 characters' });
  }

  const db = getDatabase();
  const coursesCollection = db.collection('courses');

  const regex = new RegExp(string, 'i');
  const courses = await coursesCollection.find({
      $or: [
        { name: { $regex: regex } },
        { address: { $regex: regex } }
      ]
    })
    .toArray();

  res.json({ courses });
});

router.get('/get-course-by-id', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  console.log('courseId 1', courseId);

  if (!courseId || typeof courseId !== 'string' || !courseId.trim()) {
    return res.status(400).json({ message: 'Course id is required' });
  }

  console.log('courseId 2', courseId);

  const db = getDatabase();
  const coursesCollection = db.collection('courses');

  const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });

  if (!course) {
    return res.status(404).json({ message: 'Course not found' });
  }

  res.json({ course });
});

module.exports = router;