// lib/badges.js - Modified version
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

// Load badge definitions from database
const getBadgeDefinitions = async (db) => {
  const badgeDefinitionsCollection = db.collection('badgeDefinitions');
  const result = await badgeDefinitionsCollection.findOne({ type: 'badges' });
  return result ? result.badges : [];
};

const searchForEarnedBadges = async (scorecardInput) => {

  console.log('searchForEarnedBadges scorecardInput ', scorecardInput);

  const db = getDatabase();
  const badgesCollection = db.collection('badges');
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
      number: h.number !== undefined ? h.number : (h.holeNumber !== undefined ? h.holeNumber : index + 1),
      par: h.par !== undefined ? h.par : (h.parValue !== undefined ? h.parValue : 3)
    }))
  };

  const results = Array.isArray(scorecard.results) ? scorecard.results : [];
  const uniquePlayerIds = Array.from(new Set(results.map(r => String(r.playerId))));

  console.log('uniquePlayerIds ', uniquePlayerIds);

  // Get all badge definitions
  const badgeDefinitions = await getBadgeDefinitions(db);

  const perPlayerEarned = {};
  const docsToInsert = [];
  const progressUpdates = [];

  for (const playerIdStr of uniquePlayerIds) {

    console.log('playerIdStr ', playerIdStr);

    const playerResults = results.filter(r => String(r.playerId) === playerIdStr);
    const playerId = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;

    const earnedForPlayer = [];
    const progressForPlayer = [];

    // Check ALL badge conditions for this player
    for (const badgeDef of badgeDefinitions) {
      try {
        // Execute the badge condition function
        const conditionResult = executeBadgeCondition(badgeDef, playerResults, normalizedLayout);

        console.log('conditionResult ', conditionResult);
        
        if (conditionResult !== false && conditionResult !== 0) {
          // Badge condition was met
          if (badgeDef.isUnique) {
            // Unique badge - check if already earned
            const existing = await badgesCollection.findOne({
              userId: playerId,
              badgeName: badgeDef.name
            });

            if (!existing) {
              earnedForPlayer.push({
                name: badgeDef.name,
                id: badgeDef.id,
                type: 'unique'
              });
            }
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

    // Handle unique badges (insert into badges collection)
    for (const badge of earnedForPlayer) {
      docsToInsert.push({
        userId: playerId,
        badgeName: badge.name,
        badgeId: badge.id,
        courseId: courseId,
        layoutId: layout && (layout._id || layout.id),
        dateEarned: new Date(),
        verified: 'pending',
        verifiedBy: null
      });
    }

    // Handle progressive badges (update progress collection)
    for (const progressData of progressForPlayer) {
      const progressUpdate = await updateBadgeProgress(playerId, progressData, badgeDefinitions);
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
    await badgesCollection.insertMany(docsToInsert);
  }

  return perPlayerEarned;
};

// Execute badge condition function
const executeBadgeCondition = (badgeDef, playerResults, layout) => {

  if (!badgeDef.condition) return false;

  console.log('executeBadgeCondition badgeDef.condition type:', typeof badgeDef.condition);
  console.log('executeBadgeCondition badgeDef.condition value:', badgeDef.condition);
  console.log('executeBadgeCondition playerResults, layout ', playerResults, layout);
  
  try {
    // If condition is a string, evaluate it
    if (typeof badgeDef.condition === 'string') {
      console.log('executeBadgeCondition function string ', badgeDef.condition);
      
      // Extract the function body from the string
      const trimmed = badgeDef.condition.trim();
      const functionStart = trimmed.indexOf('{');
      const functionEnd = trimmed.lastIndexOf('}');
      
      if (functionStart !== -1 && functionEnd !== -1) {
        const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
        console.log('Extracted function body:', functionBody);
        
        // Create function and execute it
        const func = new Function('results', 'layout', functionBody);
        console.log('Created function:', func);
        const result = func(playerResults, layout);
        console.log('Function result:', result);
        return result;
      } else {
        console.error('Invalid function format in condition');
        return false;
      }
    }
    
    // If condition is already a function
    if (typeof badgeDef.condition === 'function') {
      return badgeDef.condition(playerResults, layout);
    }
    
    return false;
  } catch (error) {
    console.error(`Error executing condition for ${badgeDef.name}:`, error);
    return false;
  }
};

// Update badge progress
const updateBadgeProgress = async (userId, progressData, badgeDefinitions) => {
  const db = getDatabase();
  const progressCollection = db.collection('userBadgeProgress');
  
  const badgeDef = badgeDefinitions.find(b => b.id === progressData.badgeId);
  if (!badgeDef || !badgeDef.tierThresholds) return null;

  // Get or create user progress
  const existingProgress = await progressCollection.findOne({
    userId: userId,
    badgeId: progressData.badgeId
  });

  let newProgress;
  let newTiers = [];

  if (existingProgress) {
    // Update existing progress
    const updatedTotal = existingProgress.totalProgress + progressData.progress;
    const newTier = calculateCurrentTier(updatedTotal, badgeDef.tierThresholds);
    
    newProgress = {
      ...existingProgress,
      totalProgress: updatedTotal,
      currentTier: newTier,
      lastUpdated: new Date(),
      tierProgress: newTier >= 0 ? [{
        tierIndex: newTier,
        achieved: true,
        achievedDate: new Date(),
        progress: updatedTotal
      }] : []
    };

    // Check for new tier achievements
    if (newTier > existingProgress.currentTier) {
      newTiers = Array.from({ length: newTier - existingProgress.currentTier }, (_, i) => existingProgress.currentTier + i + 1);
    }
  } else {
    // Create new progress
    const newTier = calculateCurrentTier(progressData.progress, badgeDef.tierThresholds);
    
    newProgress = {
      userId: userId,
      badgeId: progressData.badgeId,
      badgeName: progressData.badgeName,
      currentTier: newTier,
      totalProgress: progressData.progress,
      lastUpdated: new Date(),
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
  }

  // Update database
  await progressCollection.replaceOne(
    { userId: userId, badgeId: progressData.badgeId },
    newProgress,
    { upsert: true }
  );

  return {
    badgeId: progressData.badgeId,
    badgeName: progressData.badgeName,
    newTiers: newTiers,
    totalProgress: newProgress.totalProgress,
    currentTier: newProgress.currentTier
  };
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

module.exports = { 
  searchForEarnedBadges, 
  checkTierAchievement, 
  getUserBadgeTierAchievements 
};