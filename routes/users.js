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
    const { userId } = req.body;
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
          { from: req.user._id, to: userId },
          { from: userId, to: req.user._id }
        ],
        status: { $in: ['pending', 'accepted'] }
      },
      { $setOnInsert: {
          from: req.user._id,
          to: userId,
          status: 'pending',
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // If a document already existed, don't allow sending again
    if (!result.lastErrorObject.upserted) {
      return res.status(400).json({ message: 'Friend request already exists or you are already friends' });
    }

    res.json({ message: 'Friend request sent', status: 'pending' });

  } catch (e) {
    console.error('Error sending friend request:', e);
    res.status(500).json({ message: 'Failed to send friend request' });
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
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Check if a fore was sent from this user to the target user within the last week
    // Try to insert only if no recent fore exists in one atomic operation
    const foreDoc = {
      from: req.user._id,
      to: userId,
      message: 'Fore!',
      createdAt: now
    };

    const result = await foresCollection.findOneAndUpdate(
      {
        from: req.user._id,
        to: userId,
        createdAt: { $gte: oneWeekAgo }
      },
      { $setOnInsert: foreDoc },
      { upsert: true, returnDocument: 'after' }
    );

    // If a document already existed, don't allow sending again
    if (!result.lastErrorObject.upserted) {
      return res.status(400).json({ message: 'You have already sent a fore to this user within the last week' });
    }

    res.status(201).json({ message: 'Fore sent', fore: foreDoc });
  } catch (e) {
    console.error('Error sending fore:', e);
    res.status(500).json({ message: 'Failed to send fore' });
  }
});

// should only create new scorecard if no active scorecard exists for the current user and course
router.post('/scorecard/invite-users', requireAuth, async (req, res) => {
  try {
    const { courseId, layoutId, invitedUserIds } = req.body;

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

    let scorecard = await scorecardsCollection.findOne({ courseId: new ObjectId(courseId), creatorId: new ObjectId(req.user._id) });
    const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });

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

    if (new_notifications) {

      new_notifications.map((note) => {

        try {

          pusher.trigger(note.forUser, "scorecard-invite", {
            message: note.message,
            scorecardId: scorecardId,
            courseName: course.name
          });

        } catch (e) {
          console.error('Error sending pusher notification 1:', e);
        }

      });

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
      playerId,
      holeNumber,
      score,
      putt,
      obCount,
      specifics,
      timestamp
    } = req.body;

    // Validate required fields
    if (
      !scorecardId ||
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

    // Validate specifics fields
    const specificsFields = ['c1', 'c2', 'bullseye', 'scramble', 'throwIn'];
    for (const field of specificsFields) {
      if (typeof specifics[field] !== 'boolean') {
        return res.status(400).json({ message: `specifics.${field} must be a boolean` });
      }
    }

    const db = getDatabase();
    const scorecardsCollection = db.collection('scorecards');

    const resultObj = {
      playerId,
      holeNumber,
      score,
      putt,
      obCount,
      specifics,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    // Combine the find and update in a single query using $elemMatch to check invite
    const updatedResult = await scorecardsCollection.findOneAndUpdate(
      {
        _id: new ObjectId(scorecardId),
        $or: [
          { invites: { $elemMatch: { invitedUserId: req.user._id.toString() } } },
          { creatorId: req.user._id }
        ]
      },
      { $push: { results: resultObj } },
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
      // Either scorecard not found or user not invited
      // Check which case it is for more specific error
      const scorecard = await scorecardsCollection.findOne({ _id: new ObjectId(scorecardId) });
      if (!scorecard) {
        return res.status(404).json({ message: 'Scorecard not found' });
      }
      return res.status(403).json({ message: 'You are not invited to this scorecard', roundComplete: allResultsEntered });
    }

    res.status(201).json({ message: 'Result added to scorecard', result: resultObj, roundComplete: allResultsEntered });

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

    // Get the latest result for each unique holeNumber (by timestamp)
    let rawResults = updatedResult.results || [];
    // Group by holeNumber, keeping only the latest by timestamp
    const latestByHole = {};
    for (const result of rawResults) {
      if (
        !latestByHole[result.holeNumber] ||
        (result.timestamp && latestByHole[result.holeNumber].timestamp < result.timestamp)
      ) {
        latestByHole[result.holeNumber] = result;
      }
    }
    // Create a sorted array of results by timestamp
    const results = Object.values(latestByHole).sort((a, b) => new Date(a.holeNumber) - new Date(b.holeNumber));
    
    const earnedBadges = await searchForEarnedBadges({ 
      scorecardId: updatedResult._id, 
      results: results, 
      courseId: updatedResult.courseId, 
      layout: updatedResult.layout 
    });

    /*
    updatedResult.invites.forEach(invite => {
      pusher.trigger(invite.invitedUserId, "scorecard-completed", {
        scorecardId: scorecardId
      });
    }); */

    // Fetch course information
    const course = updatedResult.courseId 
      ? await coursesCollection.findOne({ _id: new ObjectId(updatedResult.courseId) })
      : null;

    // Get participants (similar to /scorecard/get-by-id)
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

module.exports = router;
