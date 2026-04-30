const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const { getPresignedPutUrl, getPresignedGetUrl } = require('../utils/s3');
const { searchForEarnedAchievements, searchForEarnedBadges, checkTierAchievement, getUserBadgeTierAchievements, getUserAllBadges } = require('../lib/badges');


const router = express.Router();

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2063152",
  key: "2c85b86b4c0e381ed22e",
  secret: "fc81d030a65e16481a02",
  cluster: "eu",
  useTLS: true
});



async function sendUserNotification({ forUserId, eventName, payload, expoPush, localNotification }) {
  var db = getDatabase();

  // The realtime 
  try {
    await pusher.trigger(forUserId.toString(), eventName, payload);
  } catch (e) {
    console.error('Error sending pusher notification:', e);
  }

  //the message queue
  if (localNotification) {
    try {
      const localNotificationsCollection = db.collection('local-notifications');
      await localNotificationsCollection.insertOne({
        forUser: forUserId.toString(),
        status: 'unseen',
        createdAt: new Date(),
        ...localNotification
      });
    } catch (e) {
      console.error('Error saving local notification:', e);
    }
  }

  // the push 
  if (expoPush) {
    try {
      const expoPushTokensCollection = db.collection('expoPushTokens');
      const expoPushToken = await expoPushTokensCollection.findOne({ userId: forUserId });
      console.log('expoPushToken', expoPushToken);
      await sendExpoPush({ to: expoPushToken, title: expoPush.title, body: expoPush.body });
    } catch (e) {
      console.error('Error sending Expo push notification:', e);
    }
  }

}

async function sendExpoPush({ to, title, body }) {
  if (!to) return; // no token, skip

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to: to?.expoPushToken, title: title, body: body })
    });

    console.log('response', response);

    const data = await response.json();
    console.log('data', data);

    return data;

  } catch (e) {
    console.error('Error sending Expo push notification:', e);
  }
}


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

// XP required to reach each level (level 1 = 0 XP, level 2 = 100, level 3 = 361, ...)
const XP_LEVEL_THRESHOLDS = [
  1000, 3297, 7034, 12312, 19210, 27795, 38125, 50250, 64216, 80064,
  97833, 117558, 139271, 163004, 188785, 216642, 246601, 278687, 312924, 349335,
  387941, 428764, 471823, 517139, 564730, 614614, 666809, 721333, 778202, 837432,
  899039, 963038, 1029445, 1098274, 1169539, 1243255, 1319435, 1398092, 1479239, 1562890,
  1649056, 1737751, 1828986, 1922773, 2019123, 2118048, 2219560, 2323669, 2430386, 2539722,
  2651687, 2766292, 2883546, 3003460, 3126044, 3251307, 3379259, 3509910, 3643269, 3779344,
  3918146, 4059683, 4203963, 4350996, 4500790, 4653354, 4808696, 4966824, 5127747, 5291472,
  5458008, 5627363, 5799544, 5974560, 6152418, 6333125, 6516689, 6703118, 6892418, 7084597,
  7279663, 7477622, 7678482, 7882249, 8088931, 8298534, 8511065, 8726531, 8944938, 9166293,
  9390603, 9617874, 9848113, 10081326, 10317519, 10556699, 10798872, 11044044, 11292221, 11543409
];

function getLevelFromXP(totalXP) {
  if (totalXP < 0) return 1;
  let level = 1;
  for (const threshold of XP_LEVEL_THRESHOLDS) {
    if (totalXP >= threshold) level += 1;
    else break;
  }
  return level;
}

function calculateVerifiedPercentage(allRounds) {
  const eligible = (allRounds || []).filter(r => r.mode !== 'doubles');
  const eligibleCount = eligible.length;
  if (eligibleCount === 0) return 0;
  const verifiedCount = eligible.filter(r => r.verified === 'verified' || r.verified === true).length;
  return Math.round((verifiedCount / eligibleCount) * 100);
}

const LEADERBOARD_TYPES = ['friends', 'global', 'country', '100km'];

const BRAGGING_SLOTS_COUNT = 6;

function normalizeBraggingSlots(arr) {
  const slots = Array.isArray(arr) ? arr.slice() : [];
  while (slots.length < BRAGGING_SLOTS_COUNT) {
    slots.push(null);
  }
  return slots.slice(0, BRAGGING_SLOTS_COUNT);
}

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    const db = getDatabase();
    const userSettingsCollection = db.collection('userSettings');
    const userSettings = await userSettingsCollection.findOne({ userId: new ObjectId(userId) });
    res.json(userSettings);
  } catch (err) {
    console.error('[GET /users/settings]', err);
    res.status(500).json({ message: 'Failed to get user settings' });
  }
});



router.post('/settings', requireAuth, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || typeof value !== 'object') {
      return res.status(400).json({ message: 'value is required' });
    }

    const { badgeId, slotIndex } = value;
    if (slotIndex === undefined || slotIndex === null) {
      return res.status(400).json({ message: 'slotIndex is required' });
    }
    if (badgeId === undefined) {
      return res.status(400).json({ message: 'badgeId is required' });
    }

    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= BRAGGING_SLOTS_COUNT) {
      return res.status(400).json({
        message: `slotIndex must be an integer from 0 to ${BRAGGING_SLOTS_COUNT - 1}`
      });
    }

    const db = getDatabase();
    const userSettingsCollection = db.collection('userSettings');

    const existing = await userSettingsCollection.findOne({ userId: req.user._id });

    const braggingSlots = existing ? existing.braggingSlots : [];

    const slots = normalizeBraggingSlots(braggingSlots);
    slots[idx] = badgeId;

    const userSettings = await userSettingsCollection.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { braggingSlots: slots } },
      { projection: { _id: 0, userId: 0 } },
      { upsert: true, returnDocument: 'after' }
    );
    
    res.json(userSettings);
  } catch (err) {
    console.error('[POST /users/settings]', err);
    res.status(500).json({ message: 'Failed to update user settings' });
  }
});



router.get('/course-leaderboard', requireAuth, async (req, res) => {
  try {
    const { courseId, layoutId, limit: limitRaw } = req.query;

    if (!courseId || !ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid course id is required' });
    }

    const limit = Math.min(Math.max(parseInt(String(limitRaw || '50'), 10) || 50, 1), 200);
    const courseObjectId = new ObjectId(courseId);

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const match = {
      courseId: courseObjectId,
      status: 'completed',
      'playersTotalScores.0': { $exists: true }
    };

    if (layoutId != null && String(layoutId).trim() !== '') {
      match['layout.id'] = layoutId;
    }

    const rounds = await scorecardsCollection
      .aggregate([
        { $match: match },
        { $unwind: { path: '$playersTotalScores' } },
        {
          $match: {
            'playersTotalScores.strokes': { $type: 'number', $gte: 0 }
          }
        },
        {
          $project: {
            _id: 0,
            scorecardId: '$_id',
            entityId: '$playersTotalScores.entityId',
            entityKey: { $toString: '$playersTotalScores.entityId' },
            strokes: '$playersTotalScores.strokes',
            score: '$playersTotalScores.score',
            layoutId: '$layout.id',
            layoutName: '$layout.name',
            updatedAt: '$updatedAt',
            createdAt: '$createdAt'
          }
        },
        // Keep only one leaderboard entry per user (their best round)
        { $sort: { entityKey: 1, strokes: 1, updatedAt: -1 } },
        {
          $group: {
            _id: '$entityKey',
            bestRound: { $first: '$$ROOT' }
          }
        },
        { $replaceRoot: { newRoot: '$bestRound' } },
        {
          $lookup: {
            from: 'scorecards',
            let: { entityId: '$entityId' },
            pipeline: [
              {
                $match: {
                  courseId: courseObjectId,
                  status: 'completed',
                  'playersTotalScores.0': { $exists: true },
                  ...(layoutId != null && String(layoutId).trim() !== '' ? { 'layout.id': layoutId } : {})
                }
              },
              { $unwind: { path: '$playersTotalScores' } },
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$playersTotalScores.entityId', '$$entityId'] },
                      { $eq: [{ $toString: '$playersTotalScores.entityId' }, { $toString: '$$entityId' }] }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  lastPlayed: { $ifNull: ['$updatedAt', '$createdAt'] }
                }
              },
              { $sort: { lastPlayed: -1 } },
              { $limit: 1 }
            ],
            as: '_lastPlayed'
          }
        },
        {
          $set: {
            lastPlayed: { $arrayElemAt: ['$_lastPlayed.lastPlayed', 0] }
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { entityId: '$entityId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$_id', '$$entityId'] },
                      { $eq: [{ $toString: '$_id' }, { $toString: '$$entityId' }] }
                    ]
                  }
                }
              },
              { $project: { _id: 0, username: 1, fname: 1, sname: 1, profileImage: 1 } },
              { $limit: 1 }
            ],
            as: '_lbUser'
          }
        },
        {
          $set: {
            _lbUserFirst: { $arrayElemAt: [{ $ifNull: ['$_lbUser', []] }, 0] }
          }
        },
        {
          $set: {
            username: '$_lbUserFirst.username',
            fname: '$_lbUserFirst.fname',
            sname: '$_lbUserFirst.sname',
            profileImage: '$_lbUserFirst.profileImage'
          }
        },
        { $project: { _lbUser: 0, _lbUserFirst: 0, _lastPlayed: 0, entityKey: 0 } },
        { $sort: { strokes: 1, updatedAt: -1 } },
        { $limit: limit }
      ])
      .toArray();

    res.json({ rounds });

  } catch (e) {
    console.error('Error fetching course leaderboard:', e);
    res.status(500).json({ message: 'Failed to fetch course leaderboard' });
  }
});



router.get('/xp-leaderboard', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const effectiveType = LEADERBOARD_TYPES.includes(type) ? type : 'global';

    const db = getDatabase();
    const userXPTotalsCollection = db.collection('userXPTotals');
    const usersCollection = db.collection('users');
    const friendsCollection = db.collection('friends');

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id instanceof ObjectId ? req.user._id : new ObjectId(String(req.user._id));

    let matchFilter = {};
    let totalCount = 0;

    if (effectiveType === 'friends') {
      const friends = await friendsCollection.find({
        $or: [{ to: currentUserId }, { from: currentUserId }],
        status: 'accepted'
      }).toArray();
      const friendIds = friends.map(f => (String(f.from) === String(currentUserId) ? f.to : f.from));
      const allowedIds = [currentUserId, ...friendIds];
      matchFilter = { _id: { $in: allowedIds } };
      totalCount = await userXPTotalsCollection.countDocuments(matchFilter);
    } else if (effectiveType === 'country') {
      const currentUser = await usersCollection.findOne(
        { _id: currentUserId },
        { projection: { country: 1 } }
      );
      const country = (currentUser && currentUser.country) ? String(currentUser.country).trim() : null;
      if (!country) {
        return res.json({
          leaderboard: [],
          pagination: { page: 1, limit, totalCount: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }
        });
      }
      const userIdsInCountry = await usersCollection.find(
        { country }
      ).project({ _id: 1 }).toArray();
      const ids = userIdsInCountry.map(u => u._id);
      matchFilter = ids.length ? { _id: { $in: ids } } : { _id: null };
      totalCount = await userXPTotalsCollection.countDocuments(matchFilter);
    } else if (effectiveType === '100km') {
      const locationParam = req.query.location;
      if (!locationParam || typeof locationParam !== 'string') {
        return res.status(400).json({ message: 'Query parameter "location" is required for 100km leaderboard (format: lat,lng)' });
      }
      const [latStr, lngStr] = locationParam.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: 'Invalid location format. Use lat,lng' });
      }
      const maxDistanceMeters = 100 * 1000;
      const nearbyUsers = await usersCollection.find({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistanceMeters
          }
        }
      }).project({ _id: 1 }).toArray();
      const ids = nearbyUsers.map(u => u._id);
      matchFilter = ids.length ? { _id: { $in: ids } } : { _id: null };
      totalCount = await userXPTotalsCollection.countDocuments(matchFilter);
    } else {
      totalCount = await userXPTotalsCollection.countDocuments({});
    }

    const totalPages = Math.ceil(totalCount / limit);

    const pipeline = [
      ...(Object.keys(matchFilter).length ? [{ $match: matchFilter }] : []),
      { $sort: { totalXP: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          totalXP: 1,
          username: '$userData.username',
          fname: '$userData.fname',
          sname: '$userData.sname',	
          profileImage: '$userData.profileImage'
        }
      }
    ];

    const leaderboard = await userXPTotalsCollection.aggregate(pipeline).toArray();

    console.log('leaderboard', leaderboard);

    res.json({
      leaderboard,
      type: effectiveType,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('[GET /users/xp-leaderboard]', err);
    res.status(500).json({ message: 'Failed to get xp leaderboard', error: err.message });
  }
});



router.get('/xp', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userXPTotalsCollection = db.collection('userXPTotals');
    const rawId = req.user._id;
    const userId = rawId instanceof ObjectId ? rawId : new ObjectId(String(rawId));
    const doc = await userXPTotalsCollection.findOne({ _id: userId });
    const totalXP = doc && typeof doc.totalXP === 'number' ? doc.totalXP : 0;
    const level = getLevelFromXP(totalXP);
    res.json({
      XP: Number(totalXP),
      level: Number(level),
      procentToNextLevel: Number((totalXP % XP_LEVEL_THRESHOLDS[level - 1]) / XP_LEVEL_THRESHOLDS[level - 1] * 100),
    });
  } catch (err) {
    console.error('[GET /users/xp]', err);
    res.status(500).json({ message: 'Failed to get user XP' });
  }
});

router.post('/profile-image', requireAuth, async (req, res) => {
  try {
    const { playerId } = req.query;
    const { image } = req.body; // base64 image string
    
    if (!image) {
      return res.status(400).json({ message: 'image (base64) is required in request body' });
    }

    const userId = playerId || req.user._id.toString();
    const targetUserId = new ObjectId(userId);

    const base64Regex = /^data:image\/(png|jpg|jpeg|gif|webp);base64,/;
    let imageBuffer;
    let contentType = 'image/png'; // default
    
    if (base64Regex.test(image)) {
      const matches = image.match(/^data:image\/(\w+);base64,/);
      contentType = `image/${matches[1]}`;
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Assume it's raw base64 without data URI prefix
      imageBuffer = Buffer.from(image, 'base64');
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ message: 'Invalid base64 image data' });
    }

    const maxSize = 500 * 1024; // 500KB
    if (imageBuffer.length > maxSize) {
      return res.status(400).json({ message: 'Image size exceeds maximum allowed size (500KB)' });
    }

    const db = getDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: targetUserId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const imageDataUri = image.includes('data:image') 
      ? image 
      : `data:${contentType};base64,${image.replace(/^data:image\/\w+;base64,/, '')}`;

    await usersCollection.updateOne(
      { _id: targetUserId },
      { 
        $set: { 
          profileImage: imageDataUri,
          profileImageContentType: contentType,
          updated_at: new Date()
        }
      }
    );

    res.status(200).json({ 
      message: 'Profile image updated successfully',
      profileImage: imageDataUri,
      contentType: contentType
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    
    // Handle ObjectId validation errors
    if (error.message && error.message.includes('ObjectId')) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Failed to upload profile image', error: error.message });
  }
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

    const courses = await db.collection('courses').aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          key: 'location',
          distanceField: '_locationDistanceMeters',
          maxDistance: maxDistance,
          spherical: true
        }
      },
      {
        $lookup: {
          from: 'achievements',
          localField: '_id',
          foreignField: 'courseId',
          as: '_ach'
        }
      },
      {
        $lookup: {
          from: 'active-default-course-achievements',
          localField: '_id',
          foreignField: 'courseId',
          as: '_activeDef'
        }
      },
      {
        $addFields: {
          achievementsCount: { $size: '$_ach' },
          activeDefaultAchievementsCount: {
            $let: {
              vars: { doc: { $arrayElemAt: ['$_activeDef', 0] } },
              in: { $size: { $ifNull: ['$$doc.templateIds', []] } }
            }
          }
        }
      },
      {
        $addFields: {
          totalAchievements: { $add: ['$achievementsCount', '$activeDefaultAchievementsCount'] }
        }
      },
      { $project: { _ach: 0, _activeDef: 0, _locationDistanceMeters: 0 } }
    ]).toArray();

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



router.post('/send-friend-request', requireAuth, async (req, res) => {
  try {
    const { userId, senderUsername, receiverUsername } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    if (userId === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const db = getDatabase();
    const friendsCollection = db.collection('friends');

    const now = new Date();

    // Try to insert, but only if no existing pending/accepted request in either direction
    const result = await friendsCollection.findOneAndUpdate(
      {
        $or: [
          { from: req.user._id, to: new ObjectId(userId) },
          { from: new ObjectId(userId), to: req.user._id }
        ],
        status: { $in: ['pending', 'accepted', 'rejected'] }
      },
      { $setOnInsert: {
          from: req.user._id,
          to: new ObjectId(userId),
          senderUsername: senderUsername,
          receiverUsername: receiverUsername,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (result) {
      const friendRequestId = result && result.value && result.value._id;

      await sendUserNotification({
        forUserId: userId,
        eventName: "friend-request-sent",
        expoPush: {
          title: `${senderUsername} sent you a friend request`,
          body: `${senderUsername} sent you a friend request`,
        },
        payload: {
          message: `${senderUsername} sent you a friend request`,
          senderUsername: senderUsername,
          senderId: req.user._id,
          receiverId: userId
        },
        localNotification: {
          fromUser: req.user._id,
          type: 'friend-request-sent',
          message: `${senderUsername} sent you a friend request`,
          friendRequestId
        }
      });

      res.json({ message: 'Friend request sent', status: 'pending' });

    } else if (result.value) {
      
      return res.status(400).json({ message: 'Friend request already exists or you are already friends' });
    } else {
      return res.status(500).json({ message: 'Failed to send friend request' });
    }

  } catch (e) {
    console.log('Error sending friend request:', e);
    res.status(500).json({ message: 'Failed to send friend request' });
  }
});



router.post('/answer-friend-request', requireAuth, async (req, res) => {
  try {
    const { from, to, docId, userId, answer, senderUsername } = req.body;
    const db = getDatabase();
    const friendsCollection = db.collection('friends');

    const result = await friendsCollection.updateOne(
      { _id: new ObjectId(docId), from: new ObjectId(from), to: new ObjectId(to), status: 'pending' }, 
      { $set: { status: answer } 
    });
    
    await sendUserNotification({
      forUserId: to,
      eventName: "friend-request-answered",
      expoPush: {
        title: `${senderUsername} ${answer} your friend request`,
        body: `${senderUsername} ${answer} your friend request`,
      },
      payload: {
        message: `${senderUsername} ${answer} your friend request`,
        from: req.user._id,
        to: userId
      },
      localNotification: {
        fromUser: req.user._id,
        type: 'friend-request-answered',
        message: `${senderUsername} ${answer} your friend request`,
        friendRequestId: docId
      }
    });
    
    res.json({ result: result.modifiedCount });
  } catch (e) {
    console.error('Error answering friend request:', e);  
    res.status(500).json({ message: 'Failed to answer friend request' });
  }
});


router.post('/cancel-friend-request', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    const result = await friendsCollection.deleteOne({ from: req.user._id, to: new ObjectId(userId), status: 'pending' });
    res.json({ result: result.deletedCount });
  } catch (e) {
    console.error('Error canceling friend request:', e);  
    res.status(500).json({ message: 'Failed to cancel friend request' });
  }
});


router.get('/pending-friend-requests', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    const currentUserId = new ObjectId(req.user._id);

    const pendingFriendRequests = await friendsCollection
      .aggregate([
        {
          $match: {
            to: currentUserId,
            status: 'pending',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'from',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            from: 1,
            to: 1,
            status: 1,
            createdAt: 1,
            // Attach a slimmed-down user object for the sender
            user: {
              _id: '$user._id',
              username: '$user.username',
              email: '$user.email',
              profileImage: '$user.profileImage',
              fname: '$user.fname',
              sname: '$user.sname',
            },
          },
        },
      ])
      .toArray();

    res.json({ pendingFriendRequests });
  } catch (e) {
    console.log('Error fetching pending friend requests:', e);
    res.status(500).json({ message: 'Failed to fetch pending friend requests' });
  }
});



router.get('/sent-friend-requests', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    
    const currentUserId = new ObjectId(req.user._id);

    const sentFriendRequests = await friendsCollection
      .aggregate([
        {
          $match: {
            from: currentUserId,
            status: 'pending',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'to',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            from: 1,
            to: 1,
            status: 1,
            createdAt: 1,
            // Attach a slimmed-down user object for the recipient
            user: {
              _id: '$user._id',
              username: '$user.username',
              email: '$user.email',
              profileImage: '$user.profileImage',
              fname: '$user.fname',
              sname: '$user.sname',
            },
          },
        },
      ])
      .toArray();
    
    res.json({ sentFriendRequests: sentFriendRequests });
  } catch (e) {
    console.log('Error fetching sent friend requests:', e);
    res.status(500).json({ message: 'Failed to fetch sent friend requests' });
  }
});



router.get('/friends', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    const currentUserId = new ObjectId(req.user._id);

    const friends = await friendsCollection
      .aggregate([
        {
          $match: {
            status: 'accepted',
            $or: [{ to: currentUserId }, { from: currentUserId }],
          },
        },
        {
          // Determine the "other" user's id in this friendship
          $addFields: {
            friendId: {
              $cond: [
                { $eq: ['$from', currentUserId] },
                '$to',
                '$from',
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'friendId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          // Omit rows where the other account no longer exists (lookup empty).
          $unwind: { path: '$user' },
        },
        {
          $project: {
            _id: 1,
            from: 1,
            to: 1,
            status: 1,
            createdAt: 1,
            user: {
              _id: '$user._id',
              username: '$user.username',
              email: '$user.email',
              profileImage: '$user.profileImage',
              fname: '$user.fname',
              sname: '$user.sname',
            },
          },
        },
      ])
      .toArray();

    res.json({ friends });
  } catch (e) {
    console.error('Error fetching friends:', e);  
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
});



router.post('/say-fore', requireAuth, async (req, res) => {

  console.log('say-fore', req.body);
  try {
    const { userId, message } = req.body;

    console.log('userId', userId);

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    if (userId === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot send a fore to yourself' });
    }

    const db = getDatabase();
    const foresCollection = db.collection('fores');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const foreDoc = {
      from: req.user._id,
      to: new ObjectId(userId),
      message: message,
      status: 'unseen',
      createdAt: now
    };

    const result = await foresCollection.insertOne(foreDoc);

    if (!result || !result.insertedId) {
      return res.status(500).json({ message: 'Failed to send fore' });
    }
    
    await sendUserNotification({
      forUserId: userId,
      eventName: "new-fore",
      expoPush: {
        title: `Fore!`,
        body: `Fore!`,
      },
      payload: {
        message: 'Fore!',
        from: req.user._id.toString(),
        to: userId
      },
      localNotification: {
        fromUser: req.user._id,
        type: 'new-fore',
        message: message || 'Fore!',
        foreId: result.insertedId
      }
    });

    res.status(201).json({ message: 'Fore sent', fore: { ...foreDoc, _id: result.insertedId } });

  } catch (e) {
    console.error('Error sending fore:', e);
    // Check if response has already been sent
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to send fore' });
    } else {
      // Log additional warning if response was already sent
      console.error('Error occurred after response was sent:', e);
    }
  }
});



router.post('/mark-fores-as-seen', requireAuth, async (req, res) => {
  try {
    const { foreIds } = req.body;

    console.log('foreIds', foreIds);

    if (!Array.isArray(foreIds) || foreIds.length === 0) {
      return res.status(400).json({ message: 'foreIds is required' });
    }

    const db = getDatabase();
    const foresCollection = db.collection('fores');

    const result = await foresCollection.updateMany(
      { _id: { $in: foreIds.map(id => new ObjectId(id)) } }, 
      { $set: { status: 'seen' } 
    });

    console.log('result', result);
    
    res.json({ result: result.modifiedCount });
  } catch (e) {
    console.error('Error marking fore as seen:', e);
    res.status(500).json({ message: 'Failed to mark fore as seen' });
  }
});



router.get('/friends/fore-thread', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const userIDObjectId = new ObjectId(userId);
    const currentUserIDObjectId = new ObjectId(req.user._id);
    
    const db = getDatabase();
    const foresCollection = db.collection('fores');
    
    const result = await foresCollection.find({
      $or: [
        { from: currentUserIDObjectId, to: userIDObjectId },
        { from: userIDObjectId, to: currentUserIDObjectId }
      ]
    }).sort({ createdAt: -1 }).toArray();

    res.json({ fores: result });
  } catch (e) {
    console.error('Error fetching fores:', e);
    res.status(500).json({ message: 'Failed to fetch fores' });
  }
});



const normalizeGuestPlayers = (guestPlayers) => {

  if (!Array.isArray(guestPlayers) || guestPlayers.length === 0) {
    return [];
  }

  return guestPlayers.map((player) => ({
    _id: player?._id,
    username: player?.username,
  }));
}



// should only create new scorecard if no active scorecard exists for the current user and course
router.post('/scorecard/invite-users', requireAuth, async (req, res) => {
  try {
    const { courseId, layoutId, invitedUserIds, guestPlayers, mode, teams, isDiceMode } = req.body;

    const normalizedInvitedUserIds = (() => {
      if (Array.isArray(invitedUserIds)) {
        return invitedUserIds;
      }

      if (typeof invitedUserIds === 'string') {
        const trimmed = invitedUserIds.trim();
        if (!trimmed) {
          return [];
        }

        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (_) {
          return [trimmed];
        }
      }

      if (invitedUserIds == null) {
        return [];
      }

      return [invitedUserIds];
    })();

    const normalizedGuestPlayers = normalizeGuestPlayers(guestPlayers);
    const userIds = [...normalizedInvitedUserIds];

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const coursesCollection = db.collection('courses');

    // const userIdsObj = userIds.map((uid) => new ObjectId(uid));

    // Find any active scorecard where any user in userIds is not already invited from the database 
    // userIdsObj.push(req.user._id);
    //userIds.push(req.user._id.toString());

    /*
    const activeScorecards = await scorecardsCollection.find({ 
      courseId, 
      status: "active", 
      $or: [
        { invites: { $elemMatch: { invitedUserId: { $in: userIds } } } },
        { creatorId: { $in: userIdsObj } }
      ]
    }).toArray();
    
    const currentUserIsOnActiveScorecard = activeScorecards.some((scorecard) => scorecard.creatorId === req.user._id.toString() || scorecard.invites.some((invite) => invite.invitedUserId === req.user._id.toString()));
    const invitedUsersAreOnActiveScorecard = activeScorecards.some((scorecard) => scorecard.invites.some((invite) => userIds.includes(invite.invitedUserId)));
    
    if (activeScorecards.length > 0) {

      return res.status(201).json({
        message: 'Users already invited to scorecard',
        scorecards: activeScorecards,
        currentUserIsOnActiveScorecard: currentUserIsOnActiveScorecard,
        invitedUsersAreOnActiveScorecard: invitedUsersAreOnActiveScorecard
      });

    }
    */

    let scorecard = await scorecardsCollection.findOne(
      { courseId: new ObjectId(courseId), creatorId: new ObjectId(req.user._id), status: 'active' }
    );
    const course = await coursesCollection.findOne(
      { _id: new ObjectId(courseId) }
    );

    // Prepare invite objects
    const now = new Date();
    const invites = userIds.map(uid => ({
      invitedUserId: new ObjectId(uid),
      invitedBy: req.user._id,
      status: 'pending',
      date: now
    }));

    let scorecardId;
    let created = false;

    let cardIsDead = ((scorecard?.invites?.length || 0) + 1) === ((scorecard?.removed?.length || 0) + (scorecard?.dnf?.length || 0));

    if (!scorecard || cardIsDead) {
      const layout = course?.layouts?.find(l => l.id === layoutId) || null;

      const newScorecard = {
        creatorId: req.user._id,
        courseId: new ObjectId(courseId),
        layout,
        results: [],
        invites,
        guestPlayers: normalizedGuestPlayers,
        mode: mode,
        teams: mode === 'doubles' && Array.isArray(teams) ? teams : undefined,
        createdAt: now,
        updatedAt: now,
        status: 'active',
        isDiceMode: isDiceMode
      };
      const result = await scorecardsCollection.insertOne(newScorecard);
      scorecard = { ...newScorecard, _id: result.insertedId };
      scorecardId = result.insertedId;
      created = true;

    } else {

      return res.status(201).json({
        message: 'Du har ett aktivt scorecard för denna bana',
        result: 'active-scorecard-exists-for-course',
        scorecard: scorecard
      });

    } /* else {
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
    } */

    const new_notifications = userIds.map(uid => ({
      forUser: uid,
      fromUser: req.user._id,
      type: 'scorecard-invite',
      message: `${req.user.username} has invited you to a scorecard`,
      status: 'unseen',
      scorecardId
    }));

    if (new_notifications.length) {
      await Promise.all(
        new_notifications.map(note =>
          sendUserNotification({
            forUserId: note.forUser,
            eventName: "scorecard-invite",
            expoPush: {
              title: `${req.user.username} has invited you to a scorecard`,
              body: `${req.user.username} has invited you to a scorecard`,
            },
            payload: {
              message: note.message,
              scorecardId: scorecardId,
              courseName: course.name
            },
            localNotification: {
              fromUser: note.fromUser,
              type: note.type,
              message: note.message,
              courseName: course.name,
              scorecardId
            }
          })
        )
      );
    }

    sendUserNotification({
      forUserId: req.user._id,
      eventName: "scorecard-invite",
      payload: {
        message: null,
        scorecardId: scorecardId,
        courseName: course.name
      },
      localNotification: {
        fromUser: req.user._id,
        type: "scorecard-invite",
        message: null,
        scorecardId
      }
    })

    res.status(201).json({
      message: userIds.length > 1
        ? 'Users invited to scorecard'
        : normalizedGuestPlayers.length > 0
          ? 'Guest players added to scorecard'
          : 'User invited to scorecard',
      scorecardId,
      invitedUserIds: userIds,
      guestPlayers: normalizedGuestPlayers,
      status: 'pending',
      date: now
    });

  } catch (e) {
    console.error('Error inviting user(s) to scorecard:', e);
    res.status(500).json({ message: 'Failed to invite user(s) to scorecard' });
  }
});



router.post('/scorecard/answer-invite', requireAuth, async (req, res) => {
  try {
    const { scorecardId, notificationId, answer } = req.body;

    if (!scorecardId || typeof answer !== "boolean") {
      return res.status(400).json({ message: 'scorecardId and answer are required (answer must be true or false)' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const inviteStatus = answer === true ? 'accepted' : 'rejected';
    const result = await scorecardsCollection.updateOne(
      { _id: new ObjectId(scorecardId), "invites.invitedUserId": req.user._id },
      { $set: { "invites.$.status": inviteStatus } }
    );

    await sendUserNotification({
      forUserId: req.user._id,
      eventName: "scorecard-invite-answered",
      expoPush: {
        title: `${req.user.username} ${answer} your scorecard invite`,
        body: `${req.user.username} ${answer} your scorecard invite`,
      },
      payload: {
        message: 'Fore!',
        senderUsername: req.user.username,
        senderId: req.user._id,
        receiverId: userId
      },
      localNotification: {
        fromUser: req.user._id,
        type: 'scorecard-invite-answered',
        message: `${req.user.username} ${answer} your scorecard invite`
      }
    });

    res.status(200).json({ inviteStatus });

  } catch (e) {
    console.error('Error fetching scorecard:', e);
    res.status(500).json({ message: 'Failed to answer invite' });
  }
});



router.get('/scorecards', requireAuth, async (req, res) => {
  try {
    const { page = 0 } = req.query;
    const limit = 50;
    const pageNum = Math.max(0, parseInt(String(page), 10) || 0);
    const skip = pageNum * limit;

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const matchFilter = {
      status: { $ne: 'archived' },
      $or: [
        { 'invites.invitedUserId': req.user._id },
        { creatorId: req.user._id }
      ],
      $nor: [
        {
          removed: {
            $elemMatch: {
              $or: [{ entityId: req.user._id }, { entityId: req.user._id.toString() }]
            }
          }
        }
      ]
    };

    // The aggregation computes the participants array and looks up user data in-line
    const [totalScorecards, scorecards] = await Promise.all([
      scorecardsCollection.countDocuments(matchFilter),
      scorecardsCollection.aggregate([
      { $match: matchFilter },
      { $sort: { updatedAt: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      {
        $addFields: {
          course: { $arrayElemAt: ["$course", 0] }
        }
      },
      // Project only certain fields from course
      {
        $addFields: {
          course: {
            _id: "$course._id",
            name: "$course.name",
            address: "$course.address",
            location: "$course.location"
          }
        }
      },
      // Compute all possible participant IDs: invited, creator, 'added', 'players'
      {
        $addFields: {
          invitedIds: {
            $cond: [
              { $and: [
                  { $isArray: ["$invites"] },
                  { $gt: [{ $size: "$invites" }, 0] }
                ]
              },
              {
                $map: {
                  input: "$invites",
                  as: "i",
                  in: "$$i.invitedUserId"
                }
              },
              []
            ]
          },
          addedIds: {
            $cond: [
              { $and: [
                { $isArray: ["$added"] },
                { $gt: [{ $size: "$added" }, 0] }
              ]},
              {
                $map: {
                  input: "$added",
                  as: "a",
                  in: {
                    $cond: [
                      { $eq: [{ $type: "$$a" }, "string"] },
                      "$$a",
                      {
                        $ifNull: ["$$a.userId", "$$a._id"]
                      }
                    ]
                  }
                }
              },
              {
                $cond: [
                  { $and: [
                    { $isArray: ["$players"] },
                    { $gt: [{ $size: "$players" }, 0] }
                  ]},
                  {
                    $map: {
                      input: "$players",
                      as: "p",
                      in: {
                        $cond: [
                          { $eq: [{ $type: "$$p" }, "string"] },
                          "$$p",
                          {
                            $ifNull: ["$$p.userId", "$$p._id"]
                          }
                        ]
                      }
                    }
                  },
                  []
                ]
              }
            ]
          },
          creatorIdArr: {
            $cond: [
              { $ifNull: ["$creatorId", false] },
              [{ $toString: "$creatorId" }],
              []
            ]
          }
        }
      },
      // Gather all unique user IDs for participants
      {
        $addFields: {
          allUserIds: {
            $setUnion: [
              { $map: { input: "$invitedIds", as: "i", in: { $toString: "$$i" } } },
              { $map: { input: "$addedIds", as: "a", in: { $toString: "$$a" } } },
              { $map: { input: "$creatorIdArr", as: "c", in: { $toString: "$$c" } } }
            ]
          }
        }
      },
      // Lookup allUserIds in users collection, get object array "allUsers"
      {
        $lookup: {
          from: "users",
          let: { ids: "$allUserIds" },
          pipeline: [
            {
              $match: {
                $expr: { $in: [{ $toString: "$_id" }, "$$ids"] }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                email: 1
              }
            }
          ],
          as: "allUsers"
        }
      },
      // Build the participants array with user fields or with just the _id if not found
      {
        $addFields: {
          participants: {
            $map: {
              input: "$allUserIds",
              as: "uid",
              in: {
                $let: {
                  vars: {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$allUsers",
                            as: "u",
                            cond: { $eq: [{ $toString: "$$u._id" }, "$$uid"] }
                          }
                        },
                        0
                      ]
                    }
                  },
                  in: {
                    $cond: [
                      { $ifNull: ["$$user", false] },
                      {
                        _id: "$$user._id",
                        username: "$$user.username",
                        email: "$$user.email"
                      },
                      { _id: "$$uid" }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          guestPlayers: {
            $cond: [
              { $isArray: "$guestPlayers" },
              "$guestPlayers",
              []
            ]
          }
        }
      },
      // Clean up: optionally suppress temp fields if you wish
      {
        $project: {
          invitedIds: 0,
          addedIds: 0,
          creatorIdArr: 0,
          allUserIds: 0,
          allUsers: 0
        }
      }
    ]).toArray()
    ]);

    res.status(200).json({ scorecards, totalScorecards, page: pageNum, limit });

  } catch (e) {
    console.error('Error fetching active scorecards:', e);
    res.status(500).json({ message: 'Failed to fetch active scorecards' });
  }
});


router.get('/scorecard', requireAuth, async (req, res) => {
  const { scorecardId } = req.query;
  if (!scorecardId) {
    return res.status(400).json({ message: 'scorecardId is required' });
  }

  const db = getDatabase();
  const scorecardsCollection = db.collection('scorecards');
  const usersCollection = db.collection('users');

  const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });

  if (!scorecard) {
    return res.status(404).json({ message: 'Scorecard not found' });
  }

  const invitedIds = Array.isArray(scorecard.invites) && scorecard.invites.length > 0
    ? scorecard.invites.map(i => i.invitedUserId)
    : [];

  const creatorId = scorecard.creatorId ? [scorecard.creatorId] : [];

  let addedIds = [];
  if (Array.isArray(scorecard.added)) {
    addedIds = scorecard.added.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
  } else if (Array.isArray(scorecard.players)) {
    addedIds = scorecard.players.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
  }

  const allUserIds = Array.from(
    new Set([...invitedIds, ...addedIds, ...creatorId].map(String))
  );

  const users =
    allUserIds.length > 0
      ? await usersCollection
          .find({ _id: { $in: allUserIds.map(id => new ObjectId(id)) } })
          .project({ _id: 1, username: 1, email: 1 }) // include any additional fields if needed
          .toArray()
      : [];

  const userMap = {};
  users.forEach(u => (userMap[u._id.toString()] = u));

  const participants = allUserIds.map(userId => {
    const userObj = userMap[userId];
    if (userObj) {
      return { _id: userObj._id, username: userObj.username, email: userObj.email };
    }
    return { _id: userId };
  });

  const expandedScorecard = {
    ...scorecard,
    participants,
  };

  res.status(200).json({ scorecard: expandedScorecard });
});


router.get('/scorecard/get-by-id', requireAuth, async (req, res) => {
  const { scorecardId } = req.query;
  if (!scorecardId) {
    return res.status(400).json({ message: 'scorecardId is required' });
  }

  const db = getDatabase();
  const scorecardsCollection = db.collection('scorecards');
  const usersCollection = db.collection('users');

  const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });

  if (!scorecard) {
    return res.status(404).json({ message: 'Scorecard not found' });
  }

  const invitedIds = Array.isArray(scorecard.invites) && scorecard.invites.length > 0
    ? scorecard.invites.map(i => i.invitedUserId)
    : [];

  const creatorId = scorecard.creatorId ? [scorecard.creatorId] : [];

  let addedIds = [];
  if (Array.isArray(scorecard.added)) {
    addedIds = scorecard.added.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
  } else if (Array.isArray(scorecard.players)) {
    addedIds = scorecard.players.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
  }

  const allUserIds = Array.from(
    new Set([...invitedIds, ...addedIds, ...creatorId].map(String))
  );

  const users =
    allUserIds.length > 0
      ? await usersCollection
          .find({ _id: { $in: allUserIds.map(id => new ObjectId(id)) } })
          .project({ _id: 1, username: 1, email: 1 }) // include any additional fields if needed
          .toArray()
      : [];

  const userMap = {};
  users.forEach(u => (userMap[u._id.toString()] = u));

  const participants = allUserIds.map(userId => {
    const userObj = userMap[userId];
    if (userObj) {
      return { _id: userObj._id, username: userObj.username, email: userObj.email };
    }
    return { _id: userId };
  });

  const expandedScorecard = {
    ...scorecard,
    participants,
  };

  res.status(200).json({ scorecard: expandedScorecard });
});



router.post('/scorecard/add-result', requireAuth, async (req, res) => {
  try {
    const {
      scorecardId,
      entityId,
      entityType,
      holeNumber,
      score,
      putt,
      obCount,
      specifics,
      timestamp
    } = req.body;
    
    const specificsFields = ['c1', 'c2', 'bullseye', 'scramble', 'throwIn'];
    for (const field of specificsFields) {
      if (typeof specifics[field] !== 'boolean') {
        return res.status(400).json({ message: `specifics.${field} must be a boolean` });
      }
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    // Get the scorecard to check its mode
    const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });
    if (!scorecard) {
      return res.status(404).json({ message: 'Scorecard not found' });
    }

    // return if entityId is in the dnf array
    if (scorecard.dnf && scorecard.dnf.includes(entityId)) {
      return res.status(400).json({ message: 'Entity is DNF' });
    }

    const entityIdForStorage =
      entityType === 'player' && ObjectId.isValid(entityId)
        ? new ObjectId(entityId)
        : entityId;

    const resultObj = {
      entityId: entityIdForStorage,
      holeNumber,
      score,
      putt,
      obCount,
      specifics,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const notCompleted = {
      $or: [
        { status: { $exists: false } },
        { status: { $ne: 'completed' } }
      ]
    };
    const accessFilter = {
      _id: new ObjectId(scorecardId),
      $and: [
        notCompleted,
        {
          $or: [
            { invites: { $elemMatch: { invitedUserId: req.user._id } } },
            { creatorId: req.user._id }
          ]
        }
      ]
    };

    // For comparison in MongoDB aggregation,   compare entityId values
    // Use string comparison to handle both ObjectId and string cases consistently
    const entityIdMatchCondition = { $eq: ['$$r.entityId', entityIdForStorage] };

    const updatePipeline = [
      {
        $set: {
          results: {
            $cond: {
              if: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$results', []] },
                        as: 'r',
                        cond: {
                          $and: [
                            entityIdMatchCondition,
                            { $eq: ['$$r.holeNumber', holeNumber] }
                          ]
                        }
                      }
                    }
                  },
                  0
                ]
              },
              then: {
                $map: {
                  input: { $ifNull: ['$results', []] },
                  as: 'r',
                  in: {
                    $cond: {
                      if: {
                        $and: [
                          entityIdMatchCondition,
                          { $eq: ['$$r.holeNumber', holeNumber] }
                        ]
                      },
                      then: resultObj,
                      else: '$$r'
                    }
                  }
                }
              },
              else: { $concatArrays: [{ $ifNull: ['$results', []] }, [resultObj]] }
            }
          }
        }
      }
    ];

    const updatedResult = await scorecardsCollection.findOneAndUpdate(
      accessFilter,
      updatePipeline,
      { returnDocument: 'after' }
    );

    // Check if all holes for all players have a result saved in updatedResult
    let allResultsEntered = false;
    if (
      updatedResult &&
      updatedResult.layout &&
      updatedResult.layout.latestVersion &&
      Array.isArray(updatedResult.layout.latestVersion.holes) &&
      Array.isArray(updatedResult.results)
    ) {
      const holes = updatedResult.layout.latestVersion.holes;
      // Get unique playerIds for this scorecard (from result objects)
      const playerIds = Array.from(
        new Set(updatedResult.results.map(r => r.playerId))
      );
      
      // For every player, check if they have a result for every hole number
      allResultsEntered = playerIds.every(playerId => {
        return holes.every(hole =>
          updatedResult.results.some(
            r => r.playerId === playerId && r.holeNumber === hole.number
          )
        );
      });
    }
 
    if (!updatedResult) {
      // Scorecard not found, user not invited, or round already completed
      const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });
      if (!scorecard) {
        return res.status(404).json({ message: 'Scorecard not found' });
      }
      if (scorecard.status === 'completed') {
        return res.status(403).json({ message: 'Cannot update result: round is already completed', roundComplete: true });
      }
      return res.status(403).json({ message: 'You are not invited to this scorecard', roundComplete: allResultsEntered });
    }

    const recipientIds = [...scorecard.invites.map(p => p.invitedUserId), scorecard.creatorId.toString()];

    try {

      await Promise.all(
        recipientIds.map(id =>

          sendUserNotification({
            forUserId: id,
            eventName: "scorecard-updated",
            payload: {
              message: 'Scorecard updated',
              scorecardId: scorecardId
            },
            localNotification: {
              fromUser: req.user._id,
              type: 'scorecard-updated',
              message: null,
              scorecardId
            }
          })

        )
      );

    } catch (e) {
      console.error('Error sending scorecard-updated notifications:', e);
    }

    res.status(201).json({ message: 'Result saved to scorecard', result: resultObj, roundComplete: allResultsEntered });

  } catch (e) {
    console.error('Error adding result to scorecard:', e);
    res.status(500).json({ message: 'Failed to add result to scorecard' });
  }
});



router.post('/scorecard/set-entity-dnf', requireAuth, async (req, res) => {
  try {
    const { scorecardId, entityId } = req.body;

    if (!scorecardId || !entityId) {
      return res.status(400).json({ message: 'scorecardId and playerId are required' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    // return the updated scorecard after the update
    const updatedScorecard = await scorecardsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(scorecardId)
      },
      { $addToSet: { 'dnf': entityId } },
      { returnDocument: 'after' }
    );

    const scorecard = updatedScorecard;
    
    if (!scorecard) {
      return res.status(404).json({ message: 'Scorecard not found' });
    }

    const recipientIds = [...scorecard.invites.map(p => p.invitedUserId), scorecard.creatorId.toString()];

    try {

      await Promise.all(
        recipientIds.map(id =>

          sendUserNotification({
            forUserId: id,
            eventName: "scorecard-updated",
            payload: {
              message: 'Scorecard updated',
              scorecardId: scorecardId
            },
            localNotification: {
              fromUser: req.user._id,
              type: 'scorecard-updated',
              message: `Player set as DNF`,
              scorecardId
            }
          })

        )
      );

    } catch (e) {
      console.error('Error sending scorecard-updated notifications:', e);
    }

    res.status(200).json({ message: 'Player DNF set' });

  } catch (e) {
      console.error('Error setting player DNF:', e);
    res.status(500).json({ message: 'Failed to set player DNF' });
  }
});



router.post('/scorecard/remove-player', requireAuth, async (req, res) => {
  try {
    const { scorecardId, entityId } = req.body;

    if (!scorecardId || !entityId) {
      return res.status(400).json({ message: 'scorecardId and playerId are required' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    // checking if the users (entityId) results are not all submitted
    // the users results must be same length as the holes in the layout
    const resultsCheck = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });
    const usersResults = resultsCheck.results.filter(r => r.playerId === entityId);
    if (usersResults && usersResults.length === resultsCheck.layout.latestVersion.holes.length) {
      return res.status(400).json({ message: 'All results are submitted for this player' });
    }

    // Build update dynamically: archive scorecard when this is the last remaining result.
    const updateQuery = {
      $addToSet: { 'removed': { entityId: entityId, removedBy: req.user._id } }
    };
    if (resultsCheck.results.length === 1) {
      updateQuery.$set = { status: 'archived' };
    }

    const updatedScorecard = await scorecardsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(scorecardId)
      },
      updateQuery,
      { returnDocument: 'after' }
    );

    const scorecard = updatedScorecard;
    
    if (!scorecard) {
      return res.status(404).json({ message: 'Scorecard not found' });
    }

    const recipientIds = [...scorecard.invites.map(p => p.invitedUserId), scorecard.creatorId.toString()];

    try {

      await Promise.all(
        recipientIds.map(id =>

          sendUserNotification({
            forUserId: id,
            eventName: "scorecard-updated",
            payload: {
              message: 'Scorecard updated',
              scorecardId: scorecardId
            },
            localNotification: {
              fromUser: req.user._id,
              type: 'scorecard-updated',
              message: `Scorecard updated`,
              scorecardId
            }
          })

        )
      );

    } catch (e) {
      console.error('Error sending scorecard-updated notifications:', e);
    }

    res.status(200).json({ message: 'Player removed from scorecard' });

  } catch (e) {
      console.error('Error removing player from scorecard:', e);
    res.status(500).json({ message: 'Failed to remove player from scorecard' });
  }
});



router.post('/scorecard/complete-round', requireAuth, async (req, res) => {
  try {
    const { scorecardId } = req.body;

    if (!scorecardId) {
      return res.status(400).json({ message: 'scorecardId is required' });
    }
    
    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const coursesCollection = db.collection('courses');
    const usersCollection = db.collection('users');

    // find out if all holes are scored for all players if not in .removed or .dnf
    const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });

    if (scorecard.status === 'completed') {
      return res.status(400).json({ message: 'Scorecard is already completed' });
    }

    const removed = Array.isArray(scorecard.removed) ? scorecard.removed : [];
    const dnf = Array.isArray(scorecard.dnf) ? scorecard.dnf : [];
    const allHolesScored = scorecard.results.every(
      result =>
        result.holeNumber !== null &&
        !removed.includes(result.entityId) &&
        !dnf.includes(result.entityId)
    );
    if (!allHolesScored) {
      return res.status(400).json({ message: 'All holes must be scored for all players' });
    }

    const coursePar = scorecard.layout.latestVersion.holes.reduce((acc, hole) => acc + hole.par, 0);

    // an array of player results that are not in .removed or .dnf for easier querying the db
    const playerResults = scorecard.results.filter(result => !removed.includes(result.entityId) && !dnf.includes(result.entityId));
    // group by entityId and sum strokes per player → [{ entityId, result: total }, ...]
    const sumsByEntity = playerResults.reduce((acc, result) => {
      const key =
        result.entityId && typeof result.entityId.toString === 'function'
          ? result.entityId.toString()
          : String(result.entityId);
      if (!acc[key]) {
        acc[key] = { entityId: result.entityId, sum: 0 };
      }
      acc[key].sum += Number(result.score) || 0;
      return acc;
    }, {});

    const playerResultsGrouped = Object.values(sumsByEntity).map(({ entityId, sum }) => ({
      entityId,
      strokes: sum,
      score: sum - coursePar
    }));
    
    const updatedScorecard = await scorecardsCollection.findOneAndUpdate(
      { _id: new ObjectId(scorecardId) },
      { $set: { status: 'completed', playersTotalScores: playerResultsGrouped } },
      { returnDocument: 'after' }
    );

    if (!updatedScorecard) {
      return res.status(404).json({ message: 'Scorecard not found' });
    }

    let rawResults = updatedScorecard.results || [];
    
    // Group by both holeNumber AND playerId to keep all players' results
    const latestByHoleAndPlayer = {};
    for (const result of rawResults) {
      const holeNum = result.holeNumber;
      const playerId = result.entityId instanceof ObjectId ? result.entityId.toString() : String(result.entityId);
      const key = `${holeNum}-${playerId}`;
      
      if (
        !latestByHoleAndPlayer[key] ||
        (result.timestamp && latestByHoleAndPlayer[key].timestamp < result.timestamp)
      ) {
        latestByHoleAndPlayer[key] = result;
      }
    }
    // Create a sorted array of results by hole number
    const results = Object.values(latestByHoleAndPlayer).sort((a, b) => a.holeNumber - b.holeNumber);

    console.log('results', results);

    const shouldSearchBadges = updatedScorecard.mode !== 'doubles';
    let earnedBadges = [];
    let earnedAchievements = [];

    if (shouldSearchBadges) {

      console.log('Vi kollar badges');
      try {

        earnedAchievements = await searchForEarnedAchievements({
          scorecardId: updatedScorecard._id,
          results: results,
          courseId: updatedScorecard.courseId,
          layout: updatedScorecard.layout,
          scorecard: updatedScorecard
        });

        earnedBadges = await searchForEarnedBadges({
          scorecardId: updatedScorecard._id,
          results: results,
          courseId: updatedScorecard.courseId,
          layout: updatedScorecard.layout,
          scorecard: updatedScorecard
        });

        // Verify that searchForEarnedBadges completed successfully
        if (!Array.isArray(earnedBadges)) {
          earnedBadges = []; // Default to empty array on invalid result
        }
      } catch (badgeError) {
        // Log error but don't fail the entire request - badge search is non-critical
        console.error('❌ [add-result] Error in searchForEarnedBadges:', badgeError);
        console.error('   Error stack:', badgeError.stack);
        console.error('   Scorecard ID:', scorecardId);
        console.error('   Results count:', results.length);
        // Continue with empty earnedBadges array so the request can complete
        earnedBadges = [];
      }
    } else {
      console.log('⏭️ [complete-round] Skipping badge search for doubles mode');
    }

    // true if card had two players that completed the round, not in dnf
    let cardVerified = false;
    if ((updatedScorecard.invites.length + 1) - (updatedScorecard.ndf?.length ?? 0) >= 2) {
      cardVerified = true;
    }

    const scorecardSetUpdates = {};
    scorecardSetUpdates.verified = cardVerified;
    
    if (shouldSearchBadges) {
      scorecardSetUpdates.earnedBadges = earnedBadges;
      scorecardSetUpdates.earnedAchievements = earnedAchievements;
      updatedScorecard.earnedBadges = earnedBadges;
      updatedScorecard.earnedAchievements = earnedAchievements;
    }
    if (Object.keys(scorecardSetUpdates).length > 0) {
      await scorecardsCollection.updateOne(
        { _id: new ObjectId(scorecardId) },
        { $set: scorecardSetUpdates }
      );
    }
    
    const course = updatedScorecard.courseId 
      ? await coursesCollection.findOne({ _id: new ObjectId(updatedScorecard.courseId) })
      : null;

    const invitedIds = Array.isArray(updatedScorecard.invites) && updatedScorecard.invites.length > 0
      ? updatedScorecard.invites.map(i => i.invitedUserId)
      : [];

    const creatorId = updatedScorecard.creatorId ? [updatedScorecard.creatorId.toString()] : [];

    let addedIds = [];
    if (Array.isArray(updatedScorecard.added)) {
      addedIds = updatedScorecard.added.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
    } else if (Array.isArray(updatedScorecard.players)) {
      addedIds = updatedScorecard.players.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
    }

    const allUserIds = Array.from(
      new Set([...invitedIds, ...addedIds, ...creatorId].map(String))
    );

    // Notify everyone involved with the scorecard (invited users, added players, and creator)
    try {
      await Promise.all(
        allUserIds.map(userId =>
          sendUserNotification({
            forUserId: userId,
            eventName: "scorecard-completed",
            payload: {
              message: 'Scorecard completed',
              scorecardId: scorecardId
            },
            expoPush: {
              title: `Scorecard completed`,
              body: `Scorecard completed`,
            },
            localNotification: {
              fromUser: req.user._id,
              type: 'scorecard-completed',
              message: 'Scorecard completed',
              scorecardId: scorecardId
            }
          })
        )
      );
    } catch (e) {
      console.error('Error sending scorecard-completed notifications:', e);
    }

    const users =
      allUserIds.length > 0
        ? await usersCollection
            .find({ _id: { $in: allUserIds.map(id => new ObjectId(id)) } })
            .project({ _id: 1, username: 1 })
            .toArray()
        : [];

    const userMap = {};
    users.forEach(u => (userMap[u._id.toString()] = u));

    const participants = allUserIds.map(userId => {
      const userObj = userMap[userId];
      if (userObj) {
        return { _id: userObj._id.toString(), id: userObj._id.toString(), username: userObj.username };
      }
      return { _id: userId, id: userId };
    });

    // Extract layout holes
    let layoutHoles = [];
    if (updatedScorecard.layout) {
      if (updatedScorecard.layout.latestVersion && Array.isArray(updatedScorecard.layout.latestVersion.holes)) {
        layoutHoles = updatedScorecard.layout.latestVersion.holes.map(hole => ({
          holeNumber: hole.number || hole.holeNumber,
          par: hole.par,
          length: hole.length
        }));
      } else if (Array.isArray(updatedScorecard.layout.holes)) {
        layoutHoles = updatedScorecard.layout.holes.map(hole => ({
          holeNumber: hole.number || hole.holeNumber,
          par: hole.par,
          length: hole.length
        }));
      }
    }

    // Extract geolocation from course
    let geolocation = null;
    if (course && course.location && course.location.coordinates) {
      geolocation = {
        lat: course.location.coordinates[1],
        lng: course.location.coordinates[0]
      };
    } else if (course && course.geolocation) {
      geolocation = course.geolocation;
    }

    // Format response according to CompletedRoundData interface
    const completedRoundData = {
      scorecard: updatedScorecard,
      results: results,
      courseName: course?.name,
      courseId: updatedScorecard.courseId?.toString(),
      layout: layoutHoles.length > 0 ? { holes: layoutHoles } : undefined,
      participants: participants,
      createdAt: updatedScorecard.createdAt?.toISOString(),
      date: updatedScorecard.date?.toISOString() || updatedScorecard.createdAt?.toISOString(),
      status: updatedScorecard.status,
      geolocation: geolocation,
      country: course?.country
    };

    res.status(200).json({completedRoundData});

  } catch (e) {
    console.error('Error completing round:', e);
    res.status(500).json({ message: 'Failed to complete round' });
  }
});



router.get('/badges', requireAuth, async (req, res) => {
  const badges = await getUserAllBadges(req.user._id);
  res.json({ badges });
});



router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const achievementsCollection = db.collection('userAchievementProgress');
    const achievements = await achievementsCollection.find({ userId: new ObjectId(req.user._id) }).toArray();

    res.json({ achievements });

  } catch (e) {
    console.error('Error fetching achievements:', e);
    res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});



router.get('/user', requireAuth, async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ message: 'userID query parameter is required' });
  }

  try {
    const db = getDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, created_at: 0, updated_at: 0, _id: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (e) {
    console.error('Error fetching user:', e);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});



router.post('/find-users', requireAuth, async (req, res) => {
  const { string } = req.body;

  if (!string) {
    console.log('Search string is required');
    return res.status(400).json({ message: 'Search string is required' });
  }

  const db = getDatabase();
  const usersCollection = db.collection('users');

  const regex = new RegExp(string, 'i');
  const users = await usersCollection.find({
    emailVerified: true,
    $or: [
      { username: { $regex: regex } },
      { email: { $regex: regex } }
    ]
  })
  .project({ password: 0, created_at: 0, updated_at: 0, email: 0 })
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



router.get('/local-notifications', requireAuth, async (req, res) => {
  const db = getDatabase();
  const localNotificationsCollection = db.collection('local-notifications');

  const notifications = await localNotificationsCollection.find({ forUser: req.user._id.toString(), status: 'unseen' }).toArray();

  if (!notifications) {
    return res.status(404).json({ message: 'notifications not found' });
  }

  res.json({ notifications });
});



router.post('/local-notifications/mark-as-seen', requireAuth, async (req, res) => {
  const { notificationId, notificationIds } = req.body;

  const db = getDatabase();
  const localNotificationsCollection = db.collection('local-notifications');

  if (notificationId) {

    await localNotificationsCollection.updateOne(
      { _id: new ObjectId(notificationId), forUser: req.user._id.toString() },
      { $set: { status: 'seen' } }
    );
    
  } else if (notificationIds) {

    await localNotificationsCollection.updateMany(
      { _id: { $in: notificationIds.map(id => new ObjectId(id)) }, forUser: req.user._id.toString() },
      { $set: { status: 'seen' } }
    );

  }

  res.json({ success: true });
});



// GET /api/user/:userId/badge/:badgeId/tier/:tierIndex - Check if specific tier was achieved
router.get('/api/user/:userId/badge/:badgeId/tier/:tierIndex', async (req, res) => {
  try {
    const { userId, badgeId, tierIndex } = req.params;
    const targetTierIndex = parseInt(tierIndex);
    
    if (isNaN(targetTierIndex) || targetTierIndex < 0) {
      return res.status(400).json({ error: 'Invalid tier index' });
    }
    
    const result = await checkTierAchievement(userId, badgeId, targetTierIndex);
    res.json(result);
    
  } catch (error) {
    console.error('Error checking tier achievement:', error);
    res.status(500).json({ error: 'Failed to check tier achievement' });
  }
});



// GET /api/user/:userId/badge/:badgeId/tiers - Get all tier achievements for a badge
router.get('/api/user/:userId/badge/:badgeId/tiers', async (req, res) => {
  try {
    const { userId, badgeId } = req.params;
    
    const result = await getUserBadgeTierAchievements(userId, badgeId);
    res.json(result);
    
  } catch (error) {
    console.error('Error getting tier achievements:', error);
    res.status(500).json({ error: 'Failed to get tier achievements' });
  }
});



router.get('/stats/general', requireAuth, async (req, res) => {
  try {
    var { userId } = req.query;
    userId = new ObjectId(userId);
    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const badgeProgressCollection = db.collection('userBadgeProgress');
    const coursesCollection = db.collection('courses');
    const userXPTotalsCollection = db.collection('userXPTotals');

    // Match completed scorecards where user is creator or participant (playerId or entityId for singles)
    const scorecardMatch = {
      status: 'completed',
      isDiceMode: false,
      $or: [
        { creatorId: userId },
        { 'results.playerId': userId },
        { 'results.entityId': userId }
      ]
    };

    // Helper function to get ISO week number
    function getISOWeek(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function getWeekKey(date) {
      const year = date.getFullYear();
      const week = getISOWeek(date);
      return { year, week };
    }

    function getPreviousWeek(weekKey) {
      if (weekKey.week > 1) {
        return { year: weekKey.year, week: weekKey.week - 1 };
      } else {
        const lastWeekOfYear = getISOWeek(new Date(weekKey.year - 1, 11, 31));
        return { year: weekKey.year - 1, week: lastWeekOfYear };
      }
    }

    // Result belongs to current user (playerId or entityId)
    const userResultMatch = {
      $or: [
        { $expr: { $eq: ['$results.playerId', userId] } },
        { $expr: { $eq: ['$results.entityId', userId] } }
      ]
    };

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const lastYearAgo = new Date();
    lastYearAgo.setFullYear(lastYearAgo.getFullYear() - 1);
    const lastMonthAgo = new Date();
    lastMonthAgo.setDate(lastMonthAgo.getDate() - 28);
    const lastWeekAgo = new Date();
    lastWeekAgo.setDate(lastWeekAgo.getDate() - 7);

    // Single aggregation for all scorecard stats + hole-level and round-level stats
    const [scorecardStats, badgeStats, holeStatsResult, puttingArraysResult, acesResult, roundSummariesResult, xpDoc, fairwayLast6MonthsResult, fairwayLastYearResult, fairwayLastMonthResult, fairwayLastWeekResult] = await Promise.all([
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        {
          $facet: {
            roundsCount: [
              { $group: { _id: '$_id' } },
              { $count: 'count' }
            ],
            roundsPlayedCount: [
              {
                $match: {
                  $or: [
                    { 'results.playerId': userId },
                    { 'results.entityId': userId }
                  ]
                }
              },
              { $group: { _id: '$_id' } },
              { $count: 'count' }
            ],
            coursesPlayedCount: [
              {
                $match: {
                  $or: [
                    { 'results.playerId': userId },
                    { 'results.entityId': userId }
                  ]
                }
              },
              { $group: { _id: '$courseId' } },
              { $count: 'count' }
            ],
            uniqueCourses: [
              { $group: { _id: '$courseId' } },
              { $count: 'count' }
            ],
            allRounds: [
              {
                $project: {
                  createdAt: 1,
                  updatedAt: 1,
                  verified: 1,
                  courseId: 1,
                  layout: 1
                }
              }
            ]
          }
        }
      ]).toArray(),
      
      // Single aggregation for all badge stats
      badgeProgressCollection.aggregate([
        {
          $match: {
            userId: userId
          }
        },
        {
          $lookup: {
            from: 'badgeDefinitions',
            localField: 'badgeId',
            foreignField: 'id',
            as: 'badgeDef'
          }
        },
        {
          $unwind: {
            path: '$badgeDef',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $facet: {
            totalBadges: [
              {
                $match: {
                  currentTier: { $gte: 0 }
                }
              },
              { $count: 'count' }
            ],
            achievements: [
              {
                $match: {
                  currentTier: { $gte: 0 },
                  courseId: { $exists: true, $ne: null }
                }
              },
              { $count: 'count' }
            ],
            badgesByTier: [
              {
                $match: {
                  currentTier: { $gte: 0 },
                  'badgeDef.tier': { $exists: true }
                }
              },
              {
                $group: {
                  _id: { $toLower: '$badgeDef.tier' },
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]).toArray(),

      // Hole-level stats for the user (bullseye, C1, C2, OB, fairway, scramble, throw-in, aces, putting)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $unwind: '$results' },
        { $match: userResultMatch },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalHoles: { $sum: 1 },
            bullseyeCount: { $sum: { $cond: [{ $eq: ['$results.specifics.bullseye', true] }, 1, 0] } },
            c1Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c2Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            obHolesCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$results.obCount', 0] }, 0] }, 1, 0] } },
            fairwayCount: { $sum: { $cond: [{ $eq: ['$results.specifics.fairway', true] }, 1, 0] } },
            scrambleCount: { $sum: { $cond: [{ $eq: ['$results.specifics.scramble', true] }, 1, 0] } },
            scrambleSuccessCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$results.specifics.scramble', true] },
                      { $lte: ['$results.score', { $ifNull: ['$hole.par', 99] }] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            throwInCount: { $sum: { $cond: [{ $eq: ['$results.specifics.throwIn', true] }, 1, 0] } },
            acesCount: { $sum: { $cond: [{ $eq: ['$results.score', 1] }, 1, 0] } },
            puttMissedCount: { $sum: { $cond: [{ $in: ['$results.putt', ['-', '']] }, 1, 0] } },
            puttInsideCount: { $sum: { $cond: [{ $eq: ['$results.putt', 'inside'] }, 1, 0] } },
            puttOutsideCount: { $sum: { $cond: [{ $eq: ['$results.putt', 'outside'] }, 1, 0] } },
            c1HoleCount: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c1InsideCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$results.specifics.c1', true] }, { $eq: ['$results.putt', 'inside'] }] },
                  1,
                  0
                ]
              }
            },
            c1MissedCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$results.specifics.c1', true] }, { $in: ['$results.putt', ['-', '']] }] },
                  1,
                  0
                ]
              }
            },
            c2HoleCount: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            c2OutsideCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$results.specifics.c2', true] }, { $eq: ['$results.putt', 'outside'] }] },
                  1,
                  0
                ]
              }
            },
            birdiePuttAttempts: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$results.specifics.bullseye', true] },
                      { $eq: ['$results.specifics.c1', true] },
                      { $eq: ['$results.specifics.c2', true] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            birdiePuttMakes: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $or: [
                          { $eq: ['$results.specifics.bullseye', true] },
                          { $eq: ['$results.specifics.c1', true] },
                          { $eq: ['$results.specifics.c2', true] }
                        ]
                      },
                      { $in: ['$results.putt', ['inside', 'outside']] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Per-round putt arrays for putting streak (max consecutive holes without missed putt)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $unwind: '$results' },
        { $match: userResultMatch },
        { $sort: { 'results.holeNumber': 1 } },
        {
          $group: {
            _id: '$_id',
            putts: { $push: '$results.putt' }
          }
        },
        { $project: { putts: 1, _id: 0 } }
      ]).toArray(),

      // Last 3 aces with course and hole info
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $unwind: '$results' },
        { $match: userResultMatch },
        { $match: { 'results.score': 1 } },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $project: {
            courseId: 1,
            createdAt: 1,
            holeNumber: '$results.holeNumber',
            holeLength: '$hole.length',
            measureInMeters: '$hole.measureInMeters'
          }
        },
        { $sort: { createdAt: -1 } },
        { $limit: 3 },
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
            courseName: '$course.name',
            date: '$createdAt',
            hole: '$holeNumber',
            length: '$holeLength',
            measureInMeters: 1,
            _id: 0
          }
        }
      ]).toArray(),

      // Round summaries for solo/casual/doubles and wins (mode + results for score aggregation)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        {
          $project: {
            _id: 1,
            mode: 1,
            results: 1
          }
        }
      ]).toArray(),

      userXPTotalsCollection.findOne({ _id: userId }),

      // Fairway/C1/C2/par-or-better percentages per month for last 6 months
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $unwind: '$results' },
        { $match: userResultMatch },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalHoles: { $sum: 1 },
            fairwayCount: { $sum: { $cond: [{ $eq: ['$results.specifics.fairway', true] }, 1, 0] } },
            c1Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c2Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            parOrBetterCount: {
              $sum: {
                $cond: [
                  { $lte: ['$results.score', { $ifNull: ['$hole.par', 99] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Last year: fairway/C1/C2/par-or-better % per month (12 datapoints)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $match: { createdAt: { $gte: lastYearAgo } } },
        { $unwind: '$results' },
        { $match: userResultMatch },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalHoles: { $sum: 1 },
            fairwayCount: { $sum: { $cond: [{ $eq: ['$results.specifics.fairway', true] }, 1, 0] } },
            c1Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c2Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            parOrBetterCount: {
              $sum: {
                $cond: [
                  { $lte: ['$results.score', { $ifNull: ['$hole.par', 99] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Last month: fairway/C1/C2/par-or-better % per week (4 datapoints)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $match: { createdAt: { $gte: lastMonthAgo } } },
        { $unwind: '$results' },
        { $match: userResultMatch },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              week: { $isoWeek: '$createdAt' }
            },
            totalHoles: { $sum: 1 },
            fairwayCount: { $sum: { $cond: [{ $eq: ['$results.specifics.fairway', true] }, 1, 0] } },
            c1Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c2Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            parOrBetterCount: {
              $sum: {
                $cond: [
                  { $lte: ['$results.score', { $ifNull: ['$hole.par', 99] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray(),

      // Last week: fairway/C1/C2/par-or-better % per day (7 datapoints)
      scorecardsCollection.aggregate([
        { $match: scorecardMatch },
        { $match: { createdAt: { $gte: lastWeekAgo } } },
        { $unwind: '$results' },
        { $match: userResultMatch },
        {
          $addFields: {
            hole: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$layout.latestVersion.holes', { $ifNull: ['$layout.holes', []] }] },
                    as: 'h',
                    cond: { $eq: ['$$h.number', '$results.holeNumber'] }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            totalHoles: { $sum: 1 },
            fairwayCount: { $sum: { $cond: [{ $eq: ['$results.specifics.fairway', true] }, 1, 0] } },
            c1Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c1', true] }, 1, 0] } },
            c2Count: { $sum: { $cond: [{ $eq: ['$results.specifics.c2', true] }, 1, 0] } },
            parOrBetterCount: {
              $sum: {
                $cond: [
                  { $lte: ['$results.score', { $ifNull: ['$hole.par', 99] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray()
    ]);

    const totalXP = xpDoc && typeof xpDoc.totalXP === 'number' ? xpDoc.totalXP : 0;
    const level = getLevelFromXP(totalXP);
    const procentToNextLevel = Number((totalXP % XP_LEVEL_THRESHOLDS[level - 1]) / XP_LEVEL_THRESHOLDS[level - 1] * 100);

    // Extract scorecard stats
    const scorecardData = scorecardStats[0] || {};
    const roundsCount = scorecardData.roundsCount?.[0]?.count || 0;
    const roundsPlayedCount = scorecardData.roundsPlayedCount?.[0]?.count || 0;
    const coursesPlayedCount = scorecardData.coursesPlayedCount?.[0]?.count || 0;
    const uniqueCoursesCount = scorecardData.uniqueCourses?.[0]?.count || 0;
    const allRounds = scorecardData.allRounds || [];

    const verifiedPercentage = calculateVerifiedPercentage(allRounds);

    // Calculate weekly streak
    const roundsByWeek = new Map();
    allRounds.forEach(round => {
      const date = round.createdAt || round.updatedAt;
      if (date) {
        const d = new Date(date);
        const weekKey = getWeekKey(d);
        const key = `${weekKey.year}-W${weekKey.week}`;
        if (!roundsByWeek.has(key)) {
          roundsByWeek.set(key, weekKey);
        }
      }
    });

    let weeklyStreak = 0;
    if (roundsByWeek.size > 0) {
      const now = new Date();
      const currentWeek = getWeekKey(now);
      const sortedWeeks = Array.from(roundsByWeek.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.week - a.week;
      });
      
      if (sortedWeeks.length > 0) {
        let checkWeek = sortedWeeks[0];
        const weeksDiff = (currentWeek.year - checkWeek.year) * 52 + (currentWeek.week - checkWeek.week);
        if (weeksDiff <= 1) {
          weeklyStreak = 1;
          let prevWeek = getPreviousWeek(checkWeek);
          while (roundsByWeek.has(`${prevWeek.year}-W${prevWeek.week}`)) {
            weeklyStreak++;
            prevWeek = getPreviousWeek(prevWeek);
          }
        }
      }
    }

    // Extract badge stats
    const badgeData = badgeStats[0] || {};
    const totalBadgesCount = badgeData.totalBadges?.[0]?.count || 0;
    const achievementsCount = badgeData.achievements?.[0]?.count || 0;
    
    // Build tier counts from aggregation result
    const tierCounts = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
      emerald: 0,
      ruby: 0,
      cosmic: 0
    };

    (badgeData.badgesByTier || []).forEach(item => {
      const tier = item._id;
      if (tierCounts.hasOwnProperty(tier)) {
        tierCounts[tier] = item.count;
      }
    });

    // Hole-level and putting stats
    const holeStats = holeStatsResult[0] || {};
    const totalHoles = holeStats.totalHoles || 0;
    const bullseyeCount = holeStats.bullseyeCount || 0;
    const c1Count = holeStats.c1Count || 0;
    const c2Count = holeStats.c2Count || 0;
    const obHolesCount = holeStats.obHolesCount || 0;
    const fairwayCount = holeStats.fairwayCount || 0;
    const scrambleSuccessCount = holeStats.scrambleSuccessCount || 0;
    const scrambleCount = holeStats.scrambleCount || 0;
    const throwInCount = holeStats.throwInCount || 0;
    const acesCount = holeStats.acesCount || 0;
    const puttMissedCount = holeStats.puttMissedCount || 0;
    const puttInsideCount = holeStats.puttInsideCount || 0;
    const puttOutsideCount = holeStats.puttOutsideCount || 0;
    const c1InsideCount = holeStats.c1InsideCount || 0;
    const c1MissedCount = holeStats.c1MissedCount || 0;
    const c1HoleCount = holeStats.c1HoleCount || 0;
    const c2OutsideCount = holeStats.c2OutsideCount || 0;
    const c2HoleCount = holeStats.c2HoleCount || 0;
    const birdiePuttAttempts = holeStats.birdiePuttAttempts || 0;
    const birdiePuttMakes = holeStats.birdiePuttMakes || 0;

    const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const bullseyePercentage = pct(bullseyeCount, totalHoles);
    const circle1Percentage = pct(c1Count, totalHoles);
    const circle2Percentage = pct(c2Count, totalHoles);
    const fairwayRatePercentage = pct(fairwayCount, totalHoles);

    // Build 6 datapoints: fairway/C1/C2/par-or-better % per month (oldest to newest)
    const fairwayByMonth = (fairwayLast6MonthsResult || []).reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.month}`;
      acc[key] = {
        totalHoles: row.totalHoles || 0,
        fairwayCount: row.fairwayCount || 0,
        c1Count: row.c1Count || 0,
        c2Count: row.c2Count || 0,
        parOrBetterCount: row.parOrBetterCount || 0
      };
      return acc;
    }, {});
    const now = new Date();
    const fairwayRatePercentageLast6Months = [];
    const last6MonthsLabels = [];
    const circle1PercentageLast6Months = [];
    const circle2PercentageLast6Months = [];
    const parOrBetterPercentageLast6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const data = fairwayByMonth[key] || { totalHoles: 0, fairwayCount: 0, c1Count: 0, c2Count: 0, parOrBetterCount: 0 };
      fairwayRatePercentageLast6Months.push(pct(data.fairwayCount, data.totalHoles));
      last6MonthsLabels.push(monthNamesShort[month - 1]);
      circle1PercentageLast6Months.push(pct(data.c1Count, data.totalHoles));
      circle2PercentageLast6Months.push(pct(data.c2Count, data.totalHoles));
      parOrBetterPercentageLast6Months.push(pct(data.parOrBetterCount, data.totalHoles));
    }

    // Last year: 12 datapoints (fairway/C1/C2/par-or-better per month, oldest to newest)
    const fairwayByMonthYear = (fairwayLastYearResult || []).reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.month}`;
      acc[key] = {
        totalHoles: row.totalHoles || 0,
        fairwayCount: row.fairwayCount || 0,
        c1Count: row.c1Count || 0,
        c2Count: row.c2Count || 0,
        parOrBetterCount: row.parOrBetterCount || 0
      };
      return acc;
    }, {});
    const fairwayRatePercentageLastYear = [];
    const lastYearMonthLabels = [];
    const circle1PercentageLastYear = [];
    const circle2PercentageLastYear = [];
    const parOrBetterPercentageLastYear = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const data = fairwayByMonthYear[key] || { totalHoles: 0, fairwayCount: 0, c1Count: 0, c2Count: 0, parOrBetterCount: 0 };
      fairwayRatePercentageLastYear.push(pct(data.fairwayCount, data.totalHoles));
      lastYearMonthLabels.push(`${monthNamesShort[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`);
      circle1PercentageLastYear.push(pct(data.c1Count, data.totalHoles));
      circle2PercentageLastYear.push(pct(data.c2Count, data.totalHoles));
      parOrBetterPercentageLastYear.push(pct(data.parOrBetterCount, data.totalHoles));
    }

    // Last month: 4 datapoints (fairway/C1/C2/par-or-better per week, oldest to newest)
    const fairwayByWeek = (fairwayLastMonthResult || []).reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.week}`;
      acc[key] = {
        totalHoles: row.totalHoles || 0,
        fairwayCount: row.fairwayCount || 0,
        c1Count: row.c1Count || 0,
        c2Count: row.c2Count || 0,
        parOrBetterCount: row.parOrBetterCount || 0
      };
      return acc;
    }, {});
    const fairwayRatePercentageLastMonth = [];
    const lastMonthWeekLabels = [];
    const circle1PercentageLastMonth = [];
    const circle2PercentageLastMonth = [];
    const parOrBetterPercentageLastMonth = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - 7 * i);
      const year = d.getFullYear();
      const week = getISOWeek(d);
      const key = `${year}-${week}`;
      const data = fairwayByWeek[key] || { totalHoles: 0, fairwayCount: 0, c1Count: 0, c2Count: 0, parOrBetterCount: 0 };
      fairwayRatePercentageLastMonth.push(pct(data.fairwayCount, data.totalHoles));
      lastMonthWeekLabels.push(`W${week}`);
      circle1PercentageLastMonth.push(pct(data.c1Count, data.totalHoles));
      circle2PercentageLastMonth.push(pct(data.c2Count, data.totalHoles));
      parOrBetterPercentageLastMonth.push(pct(data.parOrBetterCount, data.totalHoles));
    }

    // Last week: 7 datapoints (fairway/C1/C2/par-or-better per day, oldest to newest)
    const fairwayByDay = (fairwayLastWeekResult || []).reduce((acc, row) => {
      const key = `${row._id.year}-${row._id.month}-${row._id.day}`;
      acc[key] = {
        totalHoles: row.totalHoles || 0,
        fairwayCount: row.fairwayCount || 0,
        c1Count: row.c1Count || 0,
        c2Count: row.c2Count || 0,
        parOrBetterCount: row.parOrBetterCount || 0
      };
      return acc;
    }, {});
    const fairwayRatePercentageLastWeek = [];
    const lastWeekDayLabels = [];
    const circle1PercentageLastWeek = [];
    const circle2PercentageLastWeek = [];
    const parOrBetterPercentageLastWeek = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const data = fairwayByDay[key] || { totalHoles: 0, fairwayCount: 0, c1Count: 0, c2Count: 0, parOrBetterCount: 0 };
      fairwayRatePercentageLastWeek.push(pct(data.fairwayCount, data.totalHoles));
      const circle1Pct = pct(data.c1Count, data.totalHoles);
      const circle2Pct = pct(data.c2Count, data.totalHoles);
      const parOrBetterPct = pct(data.parOrBetterCount, data.totalHoles);
      circle1PercentageLastWeek.push(circle1Pct);
      circle2PercentageLastWeek.push(circle2Pct);
      parOrBetterPercentageLastWeek.push(parOrBetterPct);
      lastWeekDayLabels.push(dayNamesShort[d.getDay()]);
    }

    const obRatePercentage = pct(obHolesCount, totalHoles);
    const scrambleRatePercentage = scrambleCount > 0 ? pct(scrambleSuccessCount, scrambleCount) : 0;
    const accuracyPercentage = pct(bullseyeCount + c1Count + c2Count, totalHoles);
    const conversionsPercentage = pct(birdiePuttMakes, birdiePuttAttempts);
    const missedPuttsPercentage = pct(puttMissedCount, totalHoles);
    const c1xDen = c1InsideCount + c1MissedCount;
    const c1xPercentage = c1xDen > 0 ? pct(c1InsideCount, c1xDen) : 0;
    const c2xPercentageFinal = c2HoleCount > 0 ? pct(c2OutsideCount, c2HoleCount) : 0;

    // Putting streak: longest run of holes without missed putt ('-' or '')
    let puttingStreak = 0;
    for (const round of puttingArraysResult) {
      const putts = round.putts || [];
      let run = 0;
      for (const putt of putts) {
        if (putt && putt !== '-') {
          run++;
        } else {
          if (run > puttingStreak) puttingStreak = run;
          run = 0;
        }
      }
      if (run > puttingStreak) puttingStreak = run;
    }

    // Last 3 aces: format for response
    const last3Aces = (acesResult || []).map(a => ({
      courseName: a.courseName || null,
      date: a.date ? new Date(a.date).toISOString() : null,
      hole: a.hole,
      length: a.length != null ? a.length : null,
      measureInMeters: a.measureInMeters
    }));

    // Countries and distance from allRounds (courseId + layout)
    let countriesCount = 0;
    let distancePlayedKm = 0;
    const courseIdsForCountry = [...new Set(allRounds.map(r => r.courseId?.toString()).filter(Boolean))];
    if (courseIdsForCountry.length > 0) {
      const courses = await coursesCollection
        .find({ _id: { $in: courseIdsForCountry.map(id => new ObjectId(id)) } })
        .project({ country: 1 })
        .toArray();
      const countries = new Set(courses.map(c => (c.country && String(c.country).trim()) || '').filter(Boolean));
      countriesCount = countries.size;
    }
    for (const round of allRounds) {
      const holes = round.layout?.latestVersion?.holes || round.layout?.holes || [];
      const totalLength = holes.reduce((sum, h) => sum + (Number(h.length) || 0), 0);
      const inMeters = holes[0] && holes[0].measureInMeters !== false;
      distancePlayedKm += inMeters ? totalLength / 1000 : totalLength * 1.60934 / 1000;
    }
    distancePlayedKm = Math.round(distancePlayedKm * 10) / 10;

    // Solo / casual / doubles and wins from round summaries
    let totalSoloRounds = 0;
    let totalCasualRounds = 0;
    let casualWinsCount = 0;
    let totalDoublesRounds = 0;
    let totalDoublesWins = 0;
    const userIdStr = userId.toString();
    for (const doc of roundSummariesResult) {
      const results = doc.results || [];
      const playerIds = new Set(
        results.map(r => {
          const id = r.entityId != null ? r.entityId : r.playerId;
          return id && (id.toString ? id.toString() : String(id));
        })
      );
      const numPlayers = playerIds.size;
      if (doc.mode === 'doubles') {
        totalDoublesRounds++;
        // Doubles win: would need team totals; leave wins at 0 unless we have team info
      } else if (numPlayers === 1 && playerIds.has(userIdStr)) {
        totalSoloRounds++;
      } else if (numPlayers > 1) {
        totalCasualRounds++;
        const scoreByPlayer = new Map();
        for (const r of results) {
          const id = r.entityId != null ? r.entityId : r.playerId;
          const key = id && (id.toString ? id.toString() : String(id));
          if (!key) continue;
          scoreByPlayer.set(key, (scoreByPlayer.get(key) || 0) + (r.score || 0));
        }
        const scores = [...scoreByPlayer.entries()];
        if (scores.length > 0) {
          const minScore = Math.min(...scores.map(([, s]) => s));
          const userScore = scoreByPlayer.get(userIdStr);
          if (userScore !== undefined && userScore === minScore) {
            casualWinsCount++;
          }
        }
      }
    }
    const casualWinPercentage = totalCasualRounds > 0 ? pct(casualWinsCount, totalCasualRounds) : 0;

    console.log({
      XP: totalXP,
      level,
      procentToNextLevel,
      roundsCount,
      roundsPlayedCount,
      coursesPlayedCount,
      uniqueCoursesCount,
      totalBadgesCount,
      verifiedPercentage,
      weeklyStreak,
      achievementsCount,
      bronzeBadgesCount: tierCounts.bronze,
      silverBadgesCount: tierCounts.silver,
      goldBadgesCount: tierCounts.gold,
      platinumBadgesCount: tierCounts.platinum,
      diamondBadgesCount: tierCounts.diamond,
      emeraldBadgesCount: tierCounts.emerald,
      rubyBadgesCount: tierCounts.ruby,
      cosmicBadgesCount: tierCounts.cosmic,
      bullseyePercentage,
      circle1Percentage,
      circle2Percentage,
      fairwayRatePercentage,
      fairwayRatePercentageLast6Months,
      fairwayRatePercentageLastYear,
      fairwayRatePercentageLastMonth,
      fairwayRatePercentageLastWeek,
      circle1PercentageLast6Months,
      circle2PercentageLast6Months,
      parOrBetterPercentageLast6Months,
      circle1PercentageLastYear,
      circle2PercentageLastYear,
      parOrBetterPercentageLastYear,
      circle1PercentageLastMonth,
      circle2PercentageLastMonth,
      parOrBetterPercentageLastMonth,
      circle1PercentageLastWeek,
      circle2PercentageLastWeek,
      parOrBetterPercentageLastWeek,
      last6MonthsLabels,
      lastYearMonthLabels,
      lastMonthWeekLabels,
      lastWeekDayLabels,
      obRatePercentage,
      scrambleRatePercentage,
      accuracyPercentage,
      acesCount,
      throwInCount,
      last3Aces,
      puttingStreak,
      conversionsPercentage,
      missedPuttsPercentage,
      c1xPercentage,
      c2xPercentage: c2xPercentageFinal,
      countriesCount,
      distancePlayedKm,
      totalSoloRounds,
      totalCasualRounds,
      casualWinsCount,
      casualWinPercentage,
      totalDoublesRounds,
      totalDoublesWins
    });

    res.json({
      XP: Number(totalXP),
      level: Number(level),
      procentToNextLevel,
      roundsCount,
      roundsPlayedCount,
      coursesPlayedCount,
      uniqueCoursesCount,
      totalBadgesCount,
      verifiedPercentage,
      weeklyStreak,
      achievementsCount,
      bronzeBadgesCount: tierCounts.bronze,
      silverBadgesCount: tierCounts.silver,
      goldBadgesCount: tierCounts.gold,
      platinumBadgesCount: tierCounts.platinum,
      diamondBadgesCount: tierCounts.diamond,
      emeraldBadgesCount: tierCounts.emerald,
      rubyBadgesCount: tierCounts.ruby,
      cosmicBadgesCount: tierCounts.cosmic,
      bullseyePercentage,
      circle1Percentage,
      circle2Percentage,
      fairwayRatePercentage,
      fairwayRatePercentageLast6Months,
      fairwayRatePercentageLastYear,
      fairwayRatePercentageLastMonth,
      fairwayRatePercentageLastWeek,
      circle1PercentageLast6Months,
      circle2PercentageLast6Months,
      parOrBetterPercentageLast6Months,
      circle1PercentageLastYear,
      circle2PercentageLastYear,
      parOrBetterPercentageLastYear,
      circle1PercentageLastMonth,
      circle2PercentageLastMonth,
      parOrBetterPercentageLastMonth,
      circle1PercentageLastWeek,
      circle2PercentageLastWeek,
      parOrBetterPercentageLastWeek,
      last6MonthsLabels,
      lastYearMonthLabels,
      lastMonthWeekLabels,
      lastWeekDayLabels,
      obRatePercentage,
      scrambleRatePercentage,
      accuracyPercentage,
      acesCount,
      throwInCount,
      last3Aces,
      puttingStreak,
      conversionsPercentage,
      missedPuttsPercentage,
      c1xPercentage,
      c2xPercentage: c2xPercentageFinal,
      countriesCount,
      distancePlayedKm,
      totalSoloRounds,
      totalCasualRounds,
      casualWinsCount,
      casualWinPercentage,
      totalDoublesRounds,
      totalDoublesWins
    });

  } catch (e) {
    console.error('Error fetching user stats:', e);
    res.status(500).json({ message: 'Failed to fetch user stats' });
  }
});

module.exports = router;