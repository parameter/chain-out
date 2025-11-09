// lib/badges.js - Modified version
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { reportBug } = require('../lib/errorReporter');

// Load badge definitions from database
const getBadgeDefinitions = async (db) => {
  const badgeDefinitionsCollection = db.collection('badgeDefinitions');
  const result = await badgeDefinitionsCollection.find({}).toArray();
  return result ? result : [];
};

const searchForEarnedBadges = async (scorecardInput) => {

  console.log('searchForEarnedBadges scorecardInput: ', scorecardInput);

  const db = getDatabase();
  // const badgesCollection = db.collection('badges');
  const progressCollection = db.collection('userBadgeProgress');

  // Support passing a raw scorecard doc or a findOneAndUpdate result
  const scorecard = scorecardInput && scorecardInput.value ? scorecardInput.value : scorecardInput;
  if (!scorecard) return {};

  const courseId = scorecard.courseId;
  const layout = scorecard.layout || {};
  const holes = (layout.latestVersion && Array.isArray(layout.latestVersion.holes))
    ? layout.latestVersion.holes
    : Array.isArray(layout.holes) ? layout.holes : [];

  // error reporting for when the results are not the same as the holes
  if (scorecard.results.length !== holes.length) {

    reportBug({
      description: 'Results are not the same number as the number of holes',
      data: {
        scorecard: scorecard,
        layout: layout
      }
    });

    return res.status(500).json({ message: 'Results are not the same number as the number of holes' });

  }

  // Normalize layout shape used by badge conditions
  const normalizedLayout = {
    holes: holes.map((h, index) => ({
      holeNumber: h.number || h.holeNumber,
      number: h.number,
      par: h.par,
      length: h.length,
      measureInMeters: h.measureInMeters
    }))
  };

  const results = Array.isArray(scorecard.results) ? scorecard.results : [];
  const uniquePlayerIds = Array.from(new Set(results.map(r => String(r.playerId))));

  // Get all badge definitions
  const badgeDefinitions = await getBadgeDefinitions(db);

  const perPlayerEarned = {};
  const docsToInsert = [];
  const progressUpdates = [];

  for (const playerIdStr of uniquePlayerIds) {

    const playerResults = results.filter(r => String(r.playerId) === playerIdStr);
    const playerId = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;

    const earnedForPlayer = [];
    const progressForPlayer = [];

    // Check ALL badge conditions for this player 
    for (const badgeDef of badgeDefinitions) {
      try {
        // Execute the badge condition function
        const conditionResult = executeBadgeCondition(badgeDef, playerResults, normalizedLayout, courseId);
        
        if (conditionResult !== false && conditionResult !== 0) {
          // Badge condition was met
          if (badgeDef.isUnique) {
            // Unique badge - add to list (duplicates will be handled during insert)
            earnedForPlayer.push({
              name: badgeDef.name,
              courseId: courseId,
              badgeId: badgeDef._id,
              type: 'unique',
              layoutId: layout && (layout._id || layout.id)
            });
          } else {
            // Progressive badge - update progress
            const progressData = {
              badgeId: badgeDef._id,
              badgeName: badgeDef.name,
              progress: conditionResult,
              courseId: courseId,
              layoutId: layout && (layout._id || layout.id)
            };
            
            progressForPlayer.push(progressData);
          }
        }
      } catch (error) {
        console.error(`Error checking badge ${badgeDef.name}:`, error);
      }
    }

    // Handle unique badges (insert into badges collection)
    for (const badge of earnedForPlayer) {
      docsToInsert.push({
        userId: playerId,
        badgeName: badge.name,
        badgeId: badge.badgeId,
        courseId: courseId,
        layoutId: layout && (layout._id || layout.id),
        dateEarned: new Date(),
        verified: 'pending',
        verifiedBy: null,
        scorecardId: scorecardInput._id
      });
    }

    // Handle progressive badges (update progress collection) 
    /*
    for (const progressData of progressForPlayer) {
      const progressUpdate = await updateBadgeProgress(playerId, progressData, badgeDefinitions, courseId, (layout._id || layout.id), scorecardInput._id);
      if (progressUpdate) {
        progressUpdates.push(progressUpdate);
      }
    } */

    await updateBadgeProgress(playerId, progressForPlayer, badgeDefinitions, courseId, (layout._id || layout.id), scorecardInput._id);

    perPlayerEarned[playerIdStr] = {
      unique: earnedForPlayer.map(b => b.name),
      progress: progressForPlayer.map(p => p.badgeName)
    };
  }

  // Insert new unique badges (duplicates will be ignored)
  if (docsToInsert.length > 0) {
    try {
      await progressCollection.insertMany(docsToInsert, { ordered: false });
    } catch (error) {
      // Ignore duplicate key errors (E11000) - badge already exists
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  return perPlayerEarned;
};

// Execute badge condition function
const executeBadgeCondition = (badgeDef, playerResults, layout, courseId) => {

  if (!badgeDef.condition) return false;
  
  try {
    // If condition is a string, evaluate it
    if (typeof badgeDef.condition === 'string') {

      // Extract the function body from the string
      const trimmed = badgeDef.condition.trim();
      const functionStart = trimmed.indexOf('{');
      const functionEnd = trimmed.lastIndexOf('}');
      
      if (functionStart !== -1 && functionEnd !== -1) {
        const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
        
        // Create function and execute it
        const func = new Function('results', 'layout', 'courseId', functionBody);
        const result = func(playerResults, layout, courseId);
        return result;
      } else {
        console.error('Invalid function format in condition');
        return false;
      }
    }
    
    // If condition is already a function
    if (typeof badgeDef.condition === 'function') {
      return badgeDef.condition(playerResults, layout, courseId);
    }
    
    return false;
  } catch (error) {
    console.error(`Error executing condition for ${badgeDef.name}:`, error);
    return false;
  }
};

// Update badge progress for multiple badges in batch
const updateBadgeProgress = async (userId, progressForPlayer, badgeDefinitions, courseId, layoutId, scorecardId) => {
  if (!progressForPlayer || progressForPlayer.length === 0) return;

  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');

  // Build bulk write operations for all badges
  const bulkOps = [];

  for (const progressData of progressForPlayer) {
    const badgeDef = badgeDefinitions.find(b => b._id === progressData.badgeId);
    if (!badgeDef || !badgeDef.tierThresholds) continue;

    // Build aggregation pipeline for update that handles both insert and update cases
    // Calculate new totalProgress
    const totalProgressUpdate = badgeDef.trackTierThresholdZync
      ? progressData.progress
      : { $add: [{ $ifNull: ['$totalProgress', 0] }, progressData.progress] };

    // Build tier calculation pipeline - iterate through thresholds from highest to lowest
    const tierCalculation = buildTierCalculationPipeline(badgeDef.tierThresholds);

    // Build the update pipeline
    const pipeline = [
      {
        $set: {
          totalProgress: totalProgressUpdate,
          lastUpdated: new Date()
        }
      },
      {
        $set: {
          newTier: tierCalculation
        }
      },
      {
        $set: {
          currentTier: { $max: [{ $ifNull: ['$currentTier', -1] }, '$newTier'] }
        }
      },
      {
        $set: {
          completedCourses: badgeDef.trackUniqueCourses
            ? { $setUnion: [{ $ifNull: ['$completedCourses', []] }, [courseId]] }
            : { $ifNull: ['$completedCourses', []] }
        }
      },
      {
        $set: {
          trackedThresholds: badgeDef.trackTierThresholdZync
            ? { $setUnion: [{ $ifNull: ['$trackedThresholds', []] }, ['$newTier']] }
            : { $ifNull: ['$trackedThresholds', []] }
        }
      },
      {
        $set: {
          tierProgress: {
            $concatArrays: [
              { $ifNull: ['$tierProgress', []] },
              [{
                tierIndex: '$newTier',
                achieved: true,
                achievedDate: new Date(),
                courseId: courseId,
                layoutId: layoutId,
                progress: progressData.progress,
                scorecardId: scorecardId
              }]
            ]
          }
        }
      },
      {
        $unset: 'newTier'
      }
    ];

    // Build query with conditional course uniqueness check
    let query = { userId: userId, badgeId: badgeDef._id };
    if (badgeDef.trackUniqueCourses) {
      query.completedCourses = { $nin: [courseId] };
    }

    // Set default values on insert
    const setOnInsert = {
      userId: userId,
      badgeId: badgeDef._id,
      badgeName: badgeDef.name,
      currentTier: -1,
      totalProgress: 0,
      completedCourses: [],
      trackedThresholds: [],
      tierProgress: []
    };

    bulkOps.push({
      updateOne: {
        filter: query,
        update: pipeline,
        upsert: true,
        setOnInsert: setOnInsert
      }
    });
  }

  // Execute all updates in batch
  if (bulkOps.length > 0) {
    await progressCollection.bulkWrite(bulkOps, { ordered: false });
  }
};

// Build tier calculation pipeline that finds the highest tier threshold met
const buildTierCalculationPipeline = (thresholds) => {
  // Build a series of $cond expressions to find the highest tier
  // Iterate from highest threshold (last index) to lowest (first index)
  let tierCalculation = -1;
  
  // Build nested $cond expressions: if progress >= threshold[i], return i, else check next
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (i === thresholds.length - 1) {
      // Last iteration - base case
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          i,
          -1
        ]
      };
    } else {
      // Previous iterations - nested condition
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          i,
          tierCalculation
        ]
      };
    }
  }
  
  return tierCalculation;
};

// Calculate current tier based on progress
const calculateCurrentTier = (progress, thresholds) => {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (progress >= thresholds[i]) {
      return i;
    }
  }
  return -1; // No tier achieved yet
};

// Check if a specific tier was reached for a user's badge progress
const checkTierAchievement = async (userId, badgeId, targetTierIndex) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  try {
    // Get the user's progress for this specific badge
    const userProgress = await progressCollection.findOne({
      userId: userId,
      badgeId: badgeId
    });
    
    if (!userProgress) {
      return {
        achieved: false,
        currentTier: -1,
        totalProgress: 0,
        tierInfo: null
      };
    }
    
    // Check if the target tier was achieved
    const achieved = userProgress.currentTier >= targetTierIndex;
    
    // Get tier information if available
    let tierInfo = null;
    if (userProgress.tierProgress && userProgress.tierProgress.length > 0) {
      // Find the tier info for the target tier or the highest achieved tier
      tierInfo = userProgress.tierProgress.find(tier => tier.tierIndex === targetTierIndex);
      if (!tierInfo && achieved) {
        // If target tier is achieved but not in tierProgress, get the current tier info
        tierInfo = userProgress.tierProgress[0]; // Current tier is always the first (and only) entry
      }
    }
    
    return {
      achieved: achieved,
      currentTier: userProgress.currentTier,
      totalProgress: userProgress.totalProgress,
      tierInfo: tierInfo,
      lastUpdated: userProgress.lastUpdated
    };
    
  } catch (error) {
    console.error(`Error checking tier achievement for user ${userId}, badge ${badgeId}:`, error);
    return {
      achieved: false,
      currentTier: -1,
      totalProgress: 0,
      tierInfo: null,
      error: error.message
    };
  }
};

// Get all tier achievements for a user's badge
const getUserBadgeTierAchievements = async (userId, badgeId) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  try {
    const userProgress = await progressCollection.findOne({
      userId: userId,
      badgeId: badgeId
    });
    
    if (!userProgress) {
      return {
        currentTier: -1,
        totalProgress: 0,
        tierInfo: null,
        allTiersAchieved: []
      };
    }
    
    // Get badge definitions to know all possible tiers
    const badgeDefinitions = await getBadgeDefinitions(db);
    const badgeDef = badgeDefinitions.find(b => b._id === badgeId);
    
    if (!badgeDef || !badgeDef.tierThresholds) {
      return {
        currentTier: userProgress.currentTier,
        totalProgress: userProgress.totalProgress,
        tierInfo: userProgress.tierProgress?.[0] || null,
        allTiersAchieved: []
      };
    }
    
    // Calculate which tiers have been achieved
    const allTiersAchieved = [];
    for (let i = 0; i < badgeDef.tierThresholds.length; i++) {
      if (userProgress.currentTier >= i) {
        allTiersAchieved.push({
          tierIndex: i,
          threshold: badgeDef.tierThresholds[i],
          achieved: true,
          achievedDate: userProgress.tierProgress?.[0]?.achievedDate || userProgress.lastUpdated
        });
      }
    }
    
    return {
      currentTier: userProgress.currentTier,
      totalProgress: userProgress.totalProgress,
      tierInfo: userProgress.tierProgress?.[0] || null,
      allTiersAchieved: allTiersAchieved,
      lastUpdated: userProgress.lastUpdated
    };
    
  } catch (error) {
    console.error(`Error getting tier achievements for user ${userId}, badge ${badgeId}:`, error);
    return {
      currentTier: -1,
      totalProgress: 0,
      tierInfo: null,
      allTiersAchieved: [],
      error: error.message
    };
  }
};

const getUserAllBadges = async (userId) => {
  const db = getDatabase();
  const badgesCollection = db.collection('userBadgeProgress');
  const result = await badgesCollection.aggregate([
    { $match: { userId: userId } },
    {
      $lookup: {
        from: "badgeDefinitions",
        localField: "badgeId",
        foreignField: "_id",
        as: "badgeDef"
      }
    },
    {
      $unwind: "$badgeDef"
    },
    {
      $project: {
        userId: 1,
        badgeId: 1,
        currentTier: 1,
        totalProgress: 1,
        tierProgress: 1,
        lastUpdated: 1,
        badgeName: 1,
        tierPoints: "$badgeDef.tierPoints",
        tierNames: "$badgeDef.tierNames",
        quote: "$badgeDef.quote",
        description: "$badgeDef.description",
        tierDescriptionPrefix: "$badgeDef.tierDescriptionPrefix",
        tierDescriptionSuffix: "$badgeDef.tierDescriptionSuffix",
        tierThresholds: "$badgeDef.tierThresholds",
        type: "$badgeDef.type",
        isUnique: "$badgeDef.isUnique",
        trackUniqueCourses: "$badgeDef.trackUniqueCourses",
        difficulty: "$badgeDef.difficulty",
        animation: "$badgeDef.animation"
      }
    }
  ]).toArray();
  return result;
};

module.exports = { 
  searchForEarnedBadges, 
  checkTierAchievement, 
  getUserBadgeTierAchievements,
  getUserAllBadges
};