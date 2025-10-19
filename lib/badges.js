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

  console.log('executeBadgeCondition playerResults, layout ', playerResults, layout);
  
  try {
    // If condition is a string, evaluate it
    if (typeof badgeDef.condition === 'string') {
      console.log('executeBadgeCondition function string ', badgeDef.condition);
      const func = new Function('results', 'layout', `return ${badgeDef.condition}`);
      
      return func(playerResults, layout);
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
      lastUpdated: new Date()
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
      tierProgress: badgeDef.tierThresholds.map((threshold, index) => ({
        tierIndex: index,
        achieved: index <= newTier,
        achievedDate: index <= newTier ? new Date() : null,
        progress: progressData.progress
      }))
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

module.exports = searchForEarnedBadges;