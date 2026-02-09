const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const { getPresignedPutUrl, getPresignedGetUrl } = require('../utils/s3');
const { searchForEarnedBadges, checkTierAchievement, getUserBadgeTierAchievements, getUserAllBadges } = require('../lib/badges');


const router = express.Router();

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2063152",
  key: "2c85b86b4c0e381ed22e",
  secret: "fc81d030a65e16481a02",
  cluster: "eu",
  useTLS: true
});





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
  100, 361, 763, 1300, 1964, 2752, 3660, 4685, 5826, 7079, 8443, 9916,
  11495, 13178, 14963, 16848, 18830, 20909, 23082, 25347, 27703, 30148, 32681, 35299,
  38002, 40787, 43654, 46600, 49625, 52726, 55903, 59154, 62477, 65871, 69335, 72867,
  76466, 80131, 83861, 87654, 91510, 95427, 99405, 103443, 107540, 111696, 115909, 120179,
  124505, 128887, 133323, 137814, 142358, 146956, 151606, 156309, 161063, 165869, 170725, 175632,
  180589, 185595, 190651, 195755, 200908, 206108, 211356, 216650, 221992, 227380, 232813, 238292,
  243815, 249383, 254995, 260650, 266349, 272091, 277875, 283702, 289571, 295481, 301433, 307426,
  313460, 319535, 325650, 331805, 338000, 344235, 350509, 356822, 363174, 369565, 375994,
  464731, 473727, 482801, 491955, 501187
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
      
      pusher.trigger(userId.toString(), "friend-request-sent", {
        message: `${senderUsername} sent you a friend request`,
        senderUsername: senderUsername,
        senderId: req.user._id,
        receiverId: userId
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

    console.log('docId', docId);
    console.log('from', from);
    console.log('to', to);

    const result = await friendsCollection.updateOne(
      { _id: new ObjectId(docId), from: new ObjectId(from), to: new ObjectId(to), status: 'pending' }, 
      { $set: { status: answer } 
    });
    
    console.log('Friend request answered to', userId.toString(), {
      type: "friend-request-answered",
      message: `${senderUsername} ${answer} your friend request`,
      from: req.user._id,
      to: userId
    });
    
    pusher.trigger(userId.toString(), "friend-request-answered", {
      message: `${senderUsername} ${answer} your friend request`,
      from: req.user._id,
      to: userId
    });
    
    res.json({ result: result.modifiedCount });
  } catch (e) {
    console.error('Error answering friend request:', e);  
    res.status(500).json({ message: 'Failed to answer friend request' });
  }
});

router.get('/pending-friend-requests', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    
    const pendingFriendRequests = await friendsCollection.find({ to: req.user._id, status: 'pending' }).toArray();
    
    res.json({ pendingFriendRequests: pendingFriendRequests });
  } catch (e) {
    console.log('Error fetching pending friend requests:', e);
    res.status(500).json({ message: 'Failed to fetch pending friend requests' });
  }
});

router.get('/sent-friend-requests', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const friendsCollection = db.collection('friends');
    
    const sentFriendRequests = await friendsCollection.find({ from: req.user._id, status: 'pending' }).toArray();
    
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
    const usersCollection = db.collection('users');
    
    const friends = await friendsCollection.find({ $or: [{ to: req.user._id }, { from: new ObjectId(req.user._id) }], status: 'accepted' }).toArray();
    
    // Get user IDs that are not the current user
    const friendUserIds = friends.map(friend => {
      const friendId = friend.from.toString() === req.user._id.toString() ? friend.to : friend.from;
      return new ObjectId(friendId);
    });
    
    // Fetch user objects
    const users = friendUserIds.length > 0
      ? await usersCollection.find({ _id: { $in: friendUserIds } })
          .project({ password: 0, createdAt: 0, updatedAt: 0 })
          .toArray()
      : [];
    
    // Create a map of user IDs to user objects
    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });
    
    const friendsWithUsers = friends.map(friend => {
      // Determine which user is the friend (not the current user)
      const currentUserId = req.user._id.toString();
      const friendId = friend.from.toString() === currentUserId ? friend.to : friend.from;
      
      // Only add user object if it's not the current user
      let userObject = null;
      if (friendId.toString() !== currentUserId) {
        const friendUser = userMap[friendId.toString()];
        if (friendUser) {
          const { _id, ...userWithoutId } = friendUser;
          userObject = userWithoutId;
        }
      }
      
      return {
        ...friend,
        ...(userObject && { user: userObject })
      };
    });
    
    res.json({ friends: friendsWithUsers });
  } catch (e) {
    console.error('Error fetching friends:', e);  
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
});

router.post('/say-fore', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;

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
      message: 'Fore!',
      createdAt: now
    };

    const result = await foresCollection.insertOne(foreDoc);

    if (!result || !result.insertedId) {
      return res.status(500).json({ message: 'Failed to send fore' });
    }

    console.log('New fore sent to', userId.toString(), {
      type: "new-fore",
      message: 'Fore!',
      from: req.user._id,
      to: userId
    });

    pusher.trigger(userId.toString(), "new-fore", {
      message: 'Fore!',
      from: req.user._id,
      to: userId
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

router.get('/friends/received-fores', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }
    
    const targetUserId = new ObjectId(userId);
    const currentUserId = req.user._id;
    
    const db = getDatabase();
    const foresCollection = db.collection('fores');
    
    const result = await foresCollection.find({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ]
    }).sort({ createdAt: -1 }).toArray();
    
    res.json({ fores: result });
  } catch (e) {
    console.error('Error fetching fores:', e);
    res.status(500).json({ message: 'Failed to fetch fores' });
  }
});

// should only create new scorecard if no active scorecard exists for the current user and course
router.post('/scorecard/invite-users', requireAuth, async (req, res) => {
  try {
    const { courseId, layoutId, invitedUserIds, mode } = req.body;

    console.log('req.body', req.body);

    let userIds = [];
    if (Array.isArray(invitedUserIds)) {
      userIds = invitedUserIds.filter(Boolean);
    } else if (typeof invitedUserIds === 'string') {
      userIds = invitedUserIds;
    } else if (req.body.invitedUserId) {
      userIds = [req.body.invitedUserId];
    }

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
      invitedUserId: uid,
      invitedBy: req.user._id,
      status: 'pending',
      date: now
    }));

    let scorecardId;
    let created = false;

    if (!scorecard) {
      const layout = course?.layouts?.find(l => l.id === layoutId) || null;

      const newScorecard = {
        creatorId: req.user._id,
        courseId: new ObjectId(courseId),
        layout,
        results: [],
        invites,
        mode: mode,
        createdAt: now,
        updatedAt: now,
        status: 'active'
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
      scorecardId,
      createdAt: now
    }));

    console.log('new_notifications', new_notifications);

    if (new_notifications.length) {

      new_notifications.map((note) => {

        try {

          console.log('Scorecard invite sent to', note.forUser.toString(), {
            type: "scorecard-invite",
            message: note.message,
            scorecardId: scorecardId,
            courseName: course.name
          });

          pusher.trigger(note.forUser.toString(), "scorecard-invite", {
            message: note.message,
            scorecardId: scorecardId,
            courseName: course.name
          });

        } catch (e) {
          console.error('Error sending pusher notification 1:', e);
        }

      });

      console.log('I am here');

      const localNotificationsCollection = db.collection('local-notifications');
      await localNotificationsCollection.insertMany(new_notifications);

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

router.post('/scorecard/answer-invite', requireAuth, async (req, res) => {
  try {
    const { scorecardId, notificationId, answer } = req.body;

    if (!scorecardId || typeof answer !== "boolean") {
      return res.status(400).json({ message: 'scorecardId and answer are required (answer must be true or false)' });
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const localNotificationsCollection = db.collection('local-notifications');

    const inviteStatus = answer === true ? 'accepted' : 'rejected';
    const result = await scorecardsCollection.updateOne(
      { _id: new ObjectId(scorecardId), "invites.invitedUserId": req.user._id.toString() },
      { $set: { "invites.$.status": inviteStatus } }
    );

    console.log('result', result);

    if (result.modifiedCount) {
      const updateResult = await localNotificationsCollection.updateOne(
        { _id: new ObjectId(notificationId) },
        { $set: { status: 'seen' } }
      );
      console.log('updateResult', updateResult);
    }

    res.status(200).json({ inviteStatus });

  } catch (e) {
    console.error('Error fetching scorecard:', e);
    res.status(500).json({ message: 'Failed to answer invite' });
  }
});

router.get('/scorecards', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    // The aggregation computes the participants array and looks up user data in-line
    const scorecards = await scorecardsCollection.aggregate([
      {
        $match: {
          $or: [
            { "invites.invitedUserId": req.user._id },
            { creatorId: req.user._id }
          ]
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
    ]).toArray();

    console.log('scorecards', scorecards);

    res.status(200).json({ scorecards });

  } catch (e) {
    console.error('Error fetching active scorecards:', e);
    res.status(500).json({ message: 'Failed to fetch active scorecards' });
  }
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
      holeNumber,
      mode,
      score,
      putt,
      obCount,
      specifics,
      teams,
      timestamp
    } = req.body;

    const playerId = mode === 'singles' ? entityId : null;
    const teamName = mode === 'teams' ? entityId : null;

    console.log('req.body', req.body);

    if (req.body.teams) {
      console.log('teams', req.body.teams);
    }

    if (
      !scorecardId ||
      !playerId ||
      typeof playerId !== 'string' ||
      typeof holeNumber !== 'number' ||
      typeof score !== 'number' ||
      !['outside', 'inside', '-'].includes(putt) ||
      typeof obCount !== 'number' ||
      typeof specifics !== 'object' ||
      specifics === null
    ) {
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    const specificsFields = ['c1', 'c2', 'bullseye', 'scramble', 'throwIn'];
    for (const field of specificsFields) {
      if (typeof specifics[field] !== 'boolean') {
        return res.status(400).json({ message: `specifics.${field} must be a boolean` });
      }
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const playerIdObj = ObjectId.isValid(playerId) ? new ObjectId(playerId) : playerId;

    const resultObj = {
      playerId: playerIdObj, 
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
            { invites: { $elemMatch: { invitedUserId: req.user._id.toString() } } },
            { creatorId: req.user._id }
          ]
        }
      ]
    };

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
                            { $eq: ['$$r.playerId', playerIdObj] },
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
                          { $eq: ['$$r.playerId', playerIdObj] },
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

    console.log('updatedResult', updatedResult);

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
      console.log('playerIds', playerIds);
      // For every player, check if they have a result for every hole number
      allResultsEntered = playerIds.every(playerId => {
        return holes.every(hole =>
          updatedResult.results.some(
            r => r.playerId === playerId && r.holeNumber === hole.number
          )
        );
      });
    }

    console.log('allResultsEntered', allResultsEntered);
 
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

    res.status(201).json({ message: 'Result saved to scorecard', result: resultObj, roundComplete: allResultsEntered });

  } catch (e) {
    console.error('Error adding result to scorecard:', e);
    res.status(500).json({ message: 'Failed to add result to scorecard' });
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

    const updatedResult = await scorecardsCollection.findOneAndUpdate(
      { _id: new ObjectId(scorecardId) },
      { $set: { status: 'completed' } },
      { returnDocument: 'after' }
    );

    if (!updatedResult) {
      return res.status(404).json({ message: 'Scorecard not found' });
    }

    let rawResults = updatedResult.results || [];
    
    // Group by both holeNumber AND playerId to keep all players' results
    const latestByHoleAndPlayer = {};
    for (const result of rawResults) {
      const holeNum = result.holeNumber;
      const playerId = result.playerId instanceof ObjectId ? result.playerId.toString() : String(result.playerId);
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
    
    const earnedBadges = await searchForEarnedBadges({ 
      scorecardId: updatedResult._id, 
      results: results, 
      courseId: updatedResult.courseId, 
      layout: updatedResult.layout,
      scorecard: updatedResult
    });

    console.log('earnedBadges', earnedBadges);

    if (earnedBadges && earnedBadges.length > 0) {
      await scorecardsCollection.updateOne(
        { _id: new ObjectId(scorecardId) },
        { $set: { earnedBadges: earnedBadges } }
      );
      // Keep response consistent with stored field name
      updatedResult.earnedBadges = earnedBadges;
    }

    /*
    updatedResult.invites.forEach(invite => {
      pusher.trigger(invite.invitedUserId, "scorecard-completed", {
        scorecardId: scorecardId
      });
    }); */
    
    const course = updatedResult.courseId 
      ? await coursesCollection.findOne({ _id: new ObjectId(updatedResult.courseId) })
      : null;

    const invitedIds = Array.isArray(updatedResult.invites) && updatedResult.invites.length > 0
      ? updatedResult.invites.map(i => i.invitedUserId)
      : [];

    const creatorId = updatedResult.creatorId ? [updatedResult.creatorId.toString()] : [];

    let addedIds = [];
    if (Array.isArray(updatedResult.added)) {
      addedIds = updatedResult.added.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
    } else if (Array.isArray(updatedResult.players)) {
      addedIds = updatedResult.players.map(a => typeof a === 'string' ? a : a.userId || a._id).filter(Boolean);
    }

    const allUserIds = Array.from(
      new Set([...invitedIds, ...addedIds, ...creatorId].map(String))
    );

    console.log('check 1', allUserIds);

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
    if (updatedResult.layout) {
      if (updatedResult.layout.latestVersion && Array.isArray(updatedResult.layout.latestVersion.holes)) {
        layoutHoles = updatedResult.layout.latestVersion.holes.map(hole => ({
          holeNumber: hole.number || hole.holeNumber,
          par: hole.par,
          length: hole.length
        }));
      } else if (Array.isArray(updatedResult.layout.holes)) {
        layoutHoles = updatedResult.layout.holes.map(hole => ({
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
      scorecard: updatedResult,
      results: results,
      courseName: course?.name,
      courseId: updatedResult.courseId?.toString(),
      layout: layoutHoles.length > 0 ? { holes: layoutHoles } : undefined,
      participants: participants,
      createdAt: updatedResult.createdAt?.toISOString(),
      date: updatedResult.date?.toISOString() || updatedResult.createdAt?.toISOString(),
      status: updatedResult.status,
      geolocation: geolocation,
      country: course?.country
    };

    res.status(200).json(completedRoundData);
  } catch (e) {
    console.error('Error completing round:', e);
    res.status(500).json({ message: 'Failed to complete round' });
  }
});

router.get('/badges', requireAuth, async (req, res) => {
  const badges = await getUserAllBadges(req.user._id);
  res.json({ badges });
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

router.post('/courses/suggest-new-course', requireAuth, async (req, res) => {
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

router.get('/stats/general', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');
    const badgeProgressCollection = db.collection('userBadgeProgress');
    
    const userId = req.user._id;
    const userIdString = userId.toString();

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

    // Single aggregation for all scorecard stats
    const [scorecardStats, badgeStats] = await Promise.all([
      scorecardsCollection.aggregate([
        {
          $match: {
            status: 'completed',
            $or: [
              { creatorId: userId },
              { 'results.playerId': userIdString }
            ]
          }
        },
        {
          $facet: {
            roundsCount: [
              { $group: { _id: '$_id' } },
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
                  verified: 1
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
      ]).toArray()
    ]);

    // Extract scorecard stats
    const scorecardData = scorecardStats[0] || {};
    const roundsCount = scorecardData.roundsCount?.[0]?.count || 0;
    const uniqueCoursesCount = scorecardData.uniqueCourses?.[0]?.count || 0;
    const allRounds = scorecardData.allRounds || [];

    // Calculate verified percentage
    const verifiedRounds = allRounds.filter(r => r.verified === 'verified' || r.verified === true).length;
    const verifiedPercentage = roundsCount > 0 ? Math.round((verifiedRounds / roundsCount) * 100) : 0;

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

    res.json({
      roundsCount,
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
      cosmicBadgesCount: tierCounts.cosmic
    });

  } catch (e) {
    console.error('Error fetching user stats:', e);
    res.status(500).json({ message: 'Failed to fetch user stats' });
  }
});

module.exports = router;
