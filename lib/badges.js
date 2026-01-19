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

const searchForEarnedBadges = async ({ scorecardId, results, courseId, layout }) => {

  console.log('scorecardId: ', scorecardId);

  const db = getDatabase();
  // const badgesCollection = db.collection('badges');
  const progressCollection = db.collection('userBadgeProgress');

  const holes = (layout.latestVersion && Array.isArray(layout.latestVersion.holes))
    ? layout.latestVersion.holes
    : Array.isArray(layout.holes) ? layout.holes : []; 

  // error reporting for when the results are not the same as the holes
  if (holes.length === 0 || results.length % holes.length !== 0) {

    reportBug({
      description: 'Results are not the same number as the number of holes',
      data: {
        scorecard: results,
        courseId: courseId,
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

  const uniquePlayerIds = Array.from(new Set(results.map(r => String(r.playerId))));

  // Get all badge definitions
  const badgeDefinitions = await getBadgeDefinitions(db);

  // Separate badges that require historical data
  const historicalBadges = badgeDefinitions.filter(b => b.requiresHistoricalData);
  const regularBadges = badgeDefinitions.filter(b => !b.requiresHistoricalData);

  const perPlayerEarned = {};
  const docsToInsert = [];
  const bulkOps = [];

  for (const playerIdStr of uniquePlayerIds) {

    const playerResults = results.filter(r => String(r.playerId) === playerIdStr);
    const allOtherPlayersResults = results.filter(r => String(r.playerId) !== playerIdStr);
    const playerId = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;

    const earnedForPlayer = [];
    const progressForPlayer = [];

    // Check regular badge conditions for this player (current round only)
    for (const badgeDef of regularBadges) {
      try {
        // Execute the badge condition function
        const conditionResult = executeBadgeCondition(badgeDef, playerResults, normalizedLayout, { allOtherPlayersResults });
        
        if (conditionResult !== false && conditionResult !== 0) {
          // Badge condition was met
          if (badgeDef.isUnique) {
            // Unique badge - add to list (duplicates will be handled during insert)
            earnedForPlayer.push({
              name: badgeDef.name,
              courseId: courseId,
              badgeId: badgeDef.id,
              type: 'unique',
              layoutId: layout && (layout._id || layout.id)
            });
          } else {
            // Progressive badge - update progress
            const progressData = {
              badgeId: badgeDef.id,
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

    // Check historical badges using aggregate query on all scorecards
    if (historicalBadges.length > 0) {
      try {
        const historicalResults = await checkHistoricalBadges(db, playerId, historicalBadges, courseId);
        
        // Merge historical badge results into earnedForPlayer and progressForPlayer
        for (const badgeResult of historicalResults) {
          if (badgeResult.earned) {
            earnedForPlayer.push({
              name: badgeResult.name,
              courseId: badgeResult.courseId || courseId,
              badgeId: badgeResult.badgeId,
              type: 'unique',
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          }
          
          if (badgeResult.progress !== undefined && badgeResult.progress !== false && badgeResult.progress !== 0) {
            progressForPlayer.push({
              badgeId: badgeResult.badgeId,
              badgeName: badgeResult.name,
              progress: badgeResult.progress,
              courseId: badgeResult.courseId || courseId,
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          }
        }
      } catch (error) {
        console.error(`Error checking historical badges for player ${playerIdStr}:`, error);
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
        scorecardId: scorecardId
      });
    }

    // Handle progressive badges - collect bulk operations
    const progressBulkOps = updateBadgeProgress(playerId, progressForPlayer, badgeDefinitions, courseId, (layout._id || layout.id), scorecardId);
    if (progressBulkOps && progressBulkOps.length > 0) {
      bulkOps.push(...progressBulkOps);
    }

    perPlayerEarned[playerIdStr] = {
      unique: earnedForPlayer.map(b => b.name),
      progress: progressForPlayer.map(p => p.badgeName)
    };
  }

  // Convert unique badge inserts to bulk operations
  for (const doc of docsToInsert) {
    bulkOps.push({
      insertOne: {
        document: doc
      }
    });
  }

  // Execute all badge operations (unique inserts + progressive updates) in a single batch
  if (bulkOps.length > 0) {
    try {
      await progressCollection.bulkWrite(bulkOps, { ordered: false });
    } catch (error) {
      // Ignore duplicate key errors (E11000) - badge already exists
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  return perPlayerEarned;
};

/**
 * Check historical badges using aggregate query on scorecards.
 *
 * For historical badges we want to do as much work as possible inside MongoDB's
 * aggregation pipeline instead of fetching all scorecards and post‑processing them
 * in Node.
 *
 * Convention for historical badges:
 * - `badgeDef.condition` (string) contains a function body that, when executed,
 *   returns an object describing how to build the aggregate pipeline.
 *
 * Example `badgeDefinitions` document for "rounds on current course":
 *
 *   {
 *     id: 'rounds_on_current_course',
 *     name: 'Course Regular',
 *     requiresHistoricalData: true,
 *     isUnique: false,
 *     type: 'tiered',
 *     tierThresholds: [3, 10, 25],
 *     // NOTE: only the body of the function will be used – no need to include `function (...) {}`.
 *     condition: `
 *       // Build a pipeline that counts how many completed scorecards this player
 *       // has on the CURRENT course.
 *       const pipeline = [
 *         {
 *           $match: {
 *             status: 'completed',
 *             courseId: courseId,
 *             $or: [
 *               { creatorId: playerIdObj },
 *               { 'results.playerId': playerIdStr }
 *             ]
 *           }
 *         },
 *         {
 *           $group: {
 *             _id: null,
 *             value: { $sum: 1 } // number of rounds on the current course
 *           }
 *         }
 *       ];
 *
 *       // Tell the badge system how to interpret the aggregation result:
 *       return {
 *         pipeline,         // aggregation pipeline to run on scorecards
 *         valueField: 'value', // field to read from the first aggregation result document
 *         asProgress: true     // use this numeric value as progress for this badge
 *       };
 *     `
 *   }
 *
 * The placeholder above is just an example; more historical badges can store their
 * own aggregate‑building snippets in `condition` using the same pattern.
 */
const checkHistoricalBadges = async (db, playerId, historicalBadges, courseId) => {
  const scorecardsCollection = db.collection('scorecards');
  const playerIdStr = String(playerId);
  const playerIdObj = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;
  const courseIdStr = courseId ? String(courseId) : null;

  const results = [];

  // Helper: Build aggregate configuration from a historical badge's condition string.
  // The condition string is treated as the body of a function with the following signature:
  //   (playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId) => ({
  //      pipeline: [...],
  //      valueField: 'value',
  //      asProgress: true|false
  //   })
  const buildHistoricalAggregateFromCondition = (badgeDef) => {
    if (!badgeDef.condition || typeof badgeDef.condition !== 'string') {
      return null;
    }

    const trimmed = badgeDef.condition.trim();
    const functionStart = trimmed.indexOf('{');
    const functionEnd = trimmed.lastIndexOf('}');

    // If the string looks like a full function, strip the outer "function (...) { ... }"
    // and keep only the body. Otherwise, treat the entire string as the body.
    let body = trimmed;
    if (functionStart !== -1 && functionEnd !== -1 && functionEnd > functionStart) {
      body = trimmed.substring(functionStart + 1, functionEnd).trim();
    }

    try {
      const fn = new Function(
        'playerIdObj',
        'playerIdStr',
        'courseId',
        'courseIdStr',
        'ObjectId',
        body
      );
      const config = fn(playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId);

      if (!config || !Array.isArray(config.pipeline) || !config.valueField) {
        return null;
      }

      return config;
    } catch (err) {
      console.error(`Failed to build historical aggregate for badge ${badgeDef.name}:`, err);
      return null;
    }
  };

  // Process each historical badge
  for (const badgeDef of historicalBadges) {
    try {
      const aggConfig = buildHistoricalAggregateFromCondition(badgeDef);

      // If this badge doesn't define an aggregate snippet, skip it for now.
      if (!aggConfig) {
        continue;
      }

      const aggResult = await scorecardsCollection.aggregate(aggConfig.pipeline).toArray();
      const firstDoc = aggResult[0] || {};
      const value = firstDoc[aggConfig.valueField];

      if (value === undefined || value === null || value === 0 || value === false) {
        continue;
      }

      if (badgeDef.isUnique && !aggConfig.asProgress) {
        // Treat this as a unique, earned‑once historical badge
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          earned: true,
          courseId: courseId || null,
          layoutId: null
        });
      } else {
        // Treat this as progressive – use the aggregate value as progress
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          progress: value,
          courseId: courseId || null,
          layoutId: null
        });
      }
    } catch (error) {
      console.error(`Error checking historical badge ${badgeDef.name}:`, error);
    }
  }

  return results;
};

// Execute badge condition function
const executeBadgeCondition = (badgeDef, playerResults, layout, { allOtherPlayersResults }) => {

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
        const func = new Function('results', 'layout', 'allOtherPlayersResults', functionBody);
        const result = func(playerResults, layout, allOtherPlayersResults);
        return result;
      } else {
        console.error('Invalid function format in condition');
        return false;
      }
    }
    
    // If condition is already a function
    if (typeof badgeDef.condition === 'function') {
      return badgeDef.condition(playerResults, layout, allOtherPlayersResults);
    }
    
    return false;
  } catch (error) {
    console.error(`Error executing condition for ${badgeDef.name}:`, error);
    return false;
  }
};

// Update badge progress for multiple badges in batch
// Returns bulk write operations instead of executing them
const updateBadgeProgress = (userId, progressForPlayer, badgeDefinitions, courseId, layoutId, scorecardId) => {
  if (!progressForPlayer || progressForPlayer.length === 0) return [];

  // Build bulk write operations for all badges
  const bulkOps = [];

  for (const progressData of progressForPlayer) {
    const badgeDef = badgeDefinitions.find(b => b.id === progressData.badgeId);
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
          lastUpdated: new Date(),
          badgeName: badgeDef.name
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
    let query = { userId: userId, badgeId: badgeDef.id };
    if (badgeDef.trackUniqueCourses) {
      query.completedCourses = { $nin: [courseId] };
    }

    // Set default values on insert
    const setOnInsert = {
      userId: userId,
      badgeId: badgeDef.id,
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

  return bulkOps;
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
    const badgeDef = badgeDefinitions.find(b => b.id === badgeId);
    
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
  console.log('getUserAllBadges userId: ', userId);
  const db = getDatabase();
  const badgesCollection = db.collection('userBadgeProgress');
  const result = await badgesCollection.aggregate([
    { $match: { userId: userId } },
    {
      $lookup: {
        from: "badgeDefinitions",
        localField: "badgeId",
        foreignField: "id",
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