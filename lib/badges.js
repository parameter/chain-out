// lib/badges.js - Modified version
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

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

  // Normalize layout shape used by badge conditions
  const normalizedLayout = {
    holes: holes.map((h, index) => ({
      holeNumber: h.number || h.holeNumber,
      par: h.par
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
            // Unique badge - check if already earned


            console.log('checking for existing badge: ', badgeDef._id);
            console.log('playerId: ', playerId);

            const existing = await progressCollection.findOne({
              userId: playerId,
              _id: badgeDef._id
            });

            if (!existing) {
              earnedForPlayer.push({
                name: badgeDef.name,
                courseId: courseId,
                badgeId: badgeDef._id,
                type: 'unique',
                layoutId: layout && (layout._id || layout.id)
              });
            }
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
        verifiedBy: null
      });
    }

    // Handle progressive badges (update progress collection)
    for (const progressData of progressForPlayer) {
      const progressUpdate = await updateBadgeProgress(playerId, progressData, badgeDefinitions, courseId, (layout._id || layout.id));
      if (progressUpdate) {
        progressUpdates.push(progressUpdate);
      }
    }

    perPlayerEarned[playerIdStr] = {
      unique: earnedForPlayer.map(b => b.name),
      progress: progressForPlayer.map(p => p.badgeName)
    };
  }

  // Insert new unique badges
  if (docsToInsert.length > 0) {
    await progressCollection.insertMany(docsToInsert);
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
        console.log('executeBadgeCondition result: ', result);
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

// Update badge progress
const updateBadgeProgress = async (userId, progressData, badgeDefinitions, courseId, layoutId) => {

  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  const badgeDef = badgeDefinitions.find(b => b._id === progressData.badgeId);
  if (!badgeDef || !badgeDef.tierThresholds) return null;

  // Get or create user progress
  const existingProgress = await progressCollection.findOne({
    userId: userId,
    badgeId: badgeDef.id
  });

  let newProgress;
  let newTiers = [];
 
  if (existingProgress) {

    // Update existing progress with single MongoDB query
    const updatedTotal = existingProgress.totalProgress + progressData.progress;
    const newTier = calculateCurrentTier(updatedTotal, badgeDef.tierThresholds);
    
    // Prepare update operations
    const updateOps = {
      $inc: { totalProgress: progressData.progress },
      $set: { 
        currentTier: newTier,
        lastUpdated: new Date()
      }
    };
    
    // Only add course to completedCourses if this badge tracks unique courses
    if (badgeDef && badgeDef.trackUniqueCourses) {
      updateOps.$addToSet = { completedCourses: courseId };
    }
    
    // Add new tier to tierProgress if achieved 
    if (newTier >= 0) {
      updateOps.$push = {
        tierProgress: {
          tierIndex: newTier,
          achieved: true,
          achievedDate: new Date(),
          courseId: courseId,
          layoutId: layoutId,
          progress: updatedTotal
        }
      };
    }

    // Execute update query with conditional course uniqueness check
    let updateQuery = { userId: userId, badgeId: badgeDef.id };
    
    // Only check completedCourses if this badge tracks unique courses
    if (badgeDef && badgeDef.trackUniqueCourses) {
      updateQuery.completedCourses = { $nin: [courseId] }; // Only update if course not in completedCourses
    }

    const updateResult = await progressCollection.updateOne(updateQuery, updateOps);
    
    // If no documents were updated and this badge tracks unique courses, it means the course was already counted
    if (updateResult.matchedCount === 0 && badgeDef && badgeDef.trackUniqueCourses) {
      console.log(`Course ${courseId} already counted for badge ${progressData.badgeName}, skipping update`);
      return null;
    }
    
    // Check for new tier achievements
    if (newTier > existingProgress.currentTier) {
      newTiers = Array.from({ length: newTier - existingProgress.currentTier }, (_, i) => existingProgress.currentTier + i + 1);
    }
    
    // Return the updated progress info
    return {
      badgeId: badgeDef.id,
      badgeName: progressData.badgeName,
      newTiers: newTiers,
      totalProgress: updatedTotal,
      currentTier: newTier
    };
  } else {

    // Create new progress
    const newTier = calculateCurrentTier(progressData.progress, badgeDef.tierThresholds);
    
    newProgress = {
      userId: userId,
      badgeId: badgeDef.id,
      badgeName: progressData.badgeName,
      currentTier: newTier,
      totalProgress: progressData.progress,
      lastUpdated: new Date(),
      completedCourses: (badgeDef && badgeDef.trackUniqueCourses) ? [courseId] : [],
      tierProgress: newTier >= 0 ? [{
        tierIndex: newTier,
        achieved: true,
        achievedDate: new Date(),
        progress: progressData.progress
      }] : []
    };

    if (newTier >= 0) {
      newTiers = Array.from({ length: newTier + 1 }, (_, i) => i);
    }
    
    // Insert new progress document
    await progressCollection.insertOne(newProgress);
    
    return {
      badgeId: progressData.badgeId,
      badgeName: progressData.badgeName,
      newTiers: newTiers,
      totalProgress: newProgress.totalProgress,
      currentTier: newProgress.currentTier
    };
  }
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
        tierThresholds: "$badgeDef.tierThresholds"
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