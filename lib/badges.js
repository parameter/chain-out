// lib/badges.js - Modified version
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { reportBug } = require('../lib/errorReporter');

// XP values: score type (Par, Birdie, Eagle, Albatross, Ace)
const XP_SCORE = { par: 10, birdie: 15, eagle: 50, albatross: 250, ace: 500 };
// Badge tier XP: Bronze, Silver, Gold, Platinum, Diamond, Emerald, Ruby, Cosmic (tier index 0..7, 8+ = Cosmic)
const XP_TIER = [100, 250, 500, 1000, 2500, 5000, 7500, 10000];
const XP_BONUS = { cleanRound: 100, noOB: 50, newCourse: 100 };
const XP_MULTIPLIER = { hotStreakPerBirdie: 1.2, weeklyStreak: 0.10, verifiedRound: 0.10 };

/**
 * Calculate round XP from player results: score XP per hole, hot streak on birdies, clean round, no OB.
 * @param {Array} playerResults - Sorted by holeNumber, each { holeNumber, score, obCount }
 * @param {Array} holes - Layout holes with { number, par }
 * @returns {{ baseXP: number, hotStreakXP: number, cleanRound: boolean, noOB: boolean, breakdown: object }}
 */
function calculateRoundXP(playerResults, holes) {
  let baseXP = 0;
  let hotStreakXP = 0;
  let consecutiveBirdies = 0;
  let bogeyFree = true;
  let totalOB = 0;
  const holeXP = [];

  const sortedResults = [...playerResults].sort((a, b) => a.holeNumber - b.holeNumber);

  for (const r of sortedResults) {
    const hole = holes.find(h => (h.number || h.holeNumber) === r.holeNumber);
    const par = hole && (hole.par != null) ? hole.par : 3;
    const strokesVsPar = par - r.score;
    let xp = 0;
    if (r.score === 1) {
      xp = XP_SCORE.ace;
    } else if (strokesVsPar >= 3) {
      xp = XP_SCORE.albatross;
    } else if (strokesVsPar === 2) {
      xp = XP_SCORE.eagle;
    } else if (strokesVsPar === 1) {
      xp = XP_SCORE.birdie;
      consecutiveBirdies++;
      hotStreakXP += xp * (Math.pow(XP_MULTIPLIER.hotStreakPerBirdie, consecutiveBirdies - 1) - 1);
    } else if (strokesVsPar === 0) {
      xp = XP_SCORE.par;
      consecutiveBirdies = 0;
    } else {
      consecutiveBirdies = 0;
      bogeyFree = false;
    }
    baseXP += xp;
    totalOB += typeof r.obCount === 'number' ? r.obCount : 0;
    holeXP.push({ holeNumber: r.holeNumber, xp });
  }

  return {
    baseXP,
    hotStreakXP: Math.round(hotStreakXP),
    cleanRound: bogeyFree,
    noOB: totalOB === 0,
    totalOB,
    breakdown: { holeXP }
  };
}

/**
 * Get XP bonus flags: verified round, new course, weekly play streak (2+ weeks).
 */
async function getXPBonuses(db, playerId, courseId, scorecardId, scorecard) {
  const scorecardsCollection = db.collection('scorecards');
  const playerIdObj = playerId instanceof ObjectId ? playerId : new ObjectId(playerId);
  const courseIdObj = ObjectId.isValid(courseId) ? new ObjectId(courseId) : courseId;

  let verifiedRound = false;
  let newCourse = false;
  let weeklyStreak = false;

  if (scorecard && Array.isArray(scorecard.results)) {
    const playerIdsOnCard = [...new Set(scorecard.results.map(r => String(r.playerId)))];
    verifiedRound = playerIdsOnCard.length > 1;
  }

  const completedOnCourse = await scorecardsCollection.countDocuments({
    'results.playerId': playerIdObj,
    courseId: courseIdObj,
    status: 'completed',
    _id: { $ne: scorecardId instanceof ObjectId ? scorecardId : new ObjectId(scorecardId) }
  });
  newCourse = completedOnCourse === 0;

  const completedRounds = await scorecardsCollection
    .find({
      'results.playerId': playerIdObj,
      status: 'completed'
    })
    .project({ _id: 1, completedAt: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  const weekSet = new Set();
  const thisRoundDate = scorecard && (scorecard.updatedAt || scorecard.createdAt) ? new Date(scorecard.updatedAt || scorecard.createdAt) : new Date();
  for (const sc of completedRounds) {
    const d = sc.updatedAt || sc.completedAt;
    if (d) weekSet.add(getWeekKey(d));
  }
  weekSet.add(getWeekKey(thisRoundDate));
  const thisWeek = getWeekKey(thisRoundDate);
  const lastWeek = getWeekKey(subtractWeeks(thisRoundDate, 1));
  weeklyStreak = weekSet.has(thisWeek) && weekSet.has(lastWeek);

  return { verifiedRound, newCourse, weeklyStreak };
}

function getWeekKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start.getTime();
}

function subtractWeeks(d, weeks) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - weeks * 7);
  return out;
}

// Load badge definitions from database
const getBadgeDefinitions = async (db) => {
  const badgeDefinitionsCollection = db.collection('badgeDefinitions');
  const result = await badgeDefinitionsCollection.find({ done: true /*, id: { $in: ["flock_of_birdies", "birdie_hunter"] } */ }).toArray();
  return result ? result : [];
};

const searchForEarnedBadges = async ({ scorecardId, results, courseId, layout, scorecard }) => {  
  const db = getDatabase();
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

    throw new Error('Results are not the same number as the number of holes');
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

  // Normalize playerIds to ObjectIds (handle both ObjectId and string formats)
  // Note: For singles mode, results use entityId (which is playerId). For other modes, use playerId.
  // Deduplicate by string ID since ObjectIds are compared by reference
  const playerIdMap = new Map();
  const getPlayerIdFromResult = (r) => (scorecard.mode === 'singles' ? r.entityId : r.playerId);
  results.forEach(r => {
    const pid = getPlayerIdFromResult(r);
    if (pid == null) return;
    let normalizedId;
    if (pid instanceof ObjectId) {
      normalizedId = pid;
    } else if (ObjectId.isValid(pid)) {
      normalizedId = new ObjectId(pid);
    } else {
      normalizedId = pid;
    }
    const idStr = String(normalizedId);
    if (!playerIdMap.has(idStr)) {
      playerIdMap.set(idStr, normalizedId);
    }
  });
  const uniquePlayerIds = Array.from(playerIdMap.values());

  const badgeDefinitions = await getBadgeDefinitions(db);
  console.log(`\n📋 [searchForEarnedBadges] Loaded ${badgeDefinitions.length} badge definition(s)`);
  
  // Separate badges that require historical data
  const historicalBadges = badgeDefinitions.filter(b => b.requiresHistoricalData);
  const regularBadges = badgeDefinitions.filter(b => !b.requiresHistoricalData);
  
  console.log(`\n📊 [searchForEarnedBadges] Badge breakdown:`);
  console.log(`   Regular badges: ${regularBadges.length}`);
  console.log(`   Historical badges: ${historicalBadges.length}`);
  if (historicalBadges.length > 0) {
    console.log(`   Historical badge details:`);
    historicalBadges.forEach(b => {
      console.log(`     - ${b.name || b.id} (id: ${b.id}, requiresHistoricalData: ${b.requiresHistoricalData})`);
    });
  }

  const perPlayerEarned = [];
  const docsToInsert = [];
  const bulkOps = [];
  const xpIncrements = [];

  const courseIdObj = ObjectId.isValid(courseId) ? new ObjectId(courseId) : courseId;

  // Cache historical badge results to avoid duplicate calls for the same player
  const historicalBadgeCache = new Map();

  console.log(`\n👥 [searchForEarnedBadges] Processing badges for ${uniquePlayerIds.length} unique player(s): ${uniquePlayerIds.map(p => String(p)).join(', ')}`);
  
  for (const playerIdObj of uniquePlayerIds) {
    // Normalize to ObjectId for comparison
    const playerId = playerIdObj instanceof ObjectId ? playerIdObj : (ObjectId.isValid(playerIdObj) ? new ObjectId(playerIdObj) : playerIdObj);
    const playerIdStr = String(playerId);
    
    console.log(`\n🎮 [searchForEarnedBadges] Checking badges for player: ${playerIdStr}`);

    // Filter results - compare ObjectIds directly

    console.log('555 scorecard', scorecard);

    console.log('666 results', results);

    const playerResults = results.filter(r => {
      const rId = getPlayerIdFromResult(r);
      const rPlayerId = rId instanceof ObjectId ? rId : (ObjectId.isValid(rId) ? new ObjectId(rId) : rId);
      return rPlayerId.equals ? rPlayerId.equals(playerId) : rPlayerId === playerId;
    });
    const allOtherPlayersResults = results.filter(r => {
      const rId = getPlayerIdFromResult(r);
      const rPlayerId = rId instanceof ObjectId ? rId : (ObjectId.isValid(rId) ? new ObjectId(rId) : rId);
      return !(rPlayerId.equals ? rPlayerId.equals(playerId) : rPlayerId === playerId);
    });

    const earnedForPlayer = [];
    const progressForPlayer = [];

    // Check regular badge conditions for this player (current round only)
    for (const badgeDef of regularBadges) {
      try {

        const conditionResult = executeBadgeCondition(
          badgeDef, 
          playerResults, 
          normalizedLayout, 
          { 
            allOtherPlayersResults,
            currentScorecardId: scorecardId
          }
        );
        
        if (conditionResult !== false && conditionResult !== 0) {
          
          if (badgeDef.isUnique) {
            
            earnedForPlayer.push({
              name: badgeDef.name,
              courseId: courseId,
              badgeId: badgeDef.id,
              type: 'unique',
              layoutId: layout && (layout._id || layout.id)
            });
          } else {
            
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
        // Use cache to avoid duplicate calls for the same player
        let historicalResults;
        if (historicalBadgeCache.has(playerIdStr)) {
          historicalResults = historicalBadgeCache.get(playerIdStr);
        } else {
          historicalResults = await checkHistoricalBadges(db, playerId, historicalBadges, courseId, scorecardId);
          historicalBadgeCache.set(playerIdStr, historicalResults);
        }
        
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
        console.error(`\n❌ [searchForEarnedBadges] Error checking historical badges for player ${playerIdStr}:`, error);
        console.error(`   Error stack:`, error.stack);
      }
    } else {
      console.log(`\n📊 [searchForEarnedBadges] No historical badges to check for player ${playerIdStr}`);
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

    // Fetch existing badge progress for this player
    const badgeIds = progressForPlayer.map(p => p.badgeId);
    const existingProgressDocs = badgeIds.length > 0
      ? await progressCollection.find({
          userId: playerId,
          badgeId: { $in: badgeIds }
        }).toArray()
      : [];
    
    const existingProgressMap = {};
    existingProgressDocs.forEach(doc => {
      existingProgressMap[doc.badgeId] = {
        currentTier: doc.currentTier || -1,
        totalProgress: doc.totalProgress || 0
      };
    });

    const { bulkOps: progressBulkOps, badgeObjects } = updateBadgeProgress(
      playerId, 
      progressForPlayer, 
      badgeDefinitions, 
      courseId, 
      (layout._id || layout.id), 
      scorecardId,
      existingProgressMap
    );
    
    if (progressBulkOps && progressBulkOps.length > 0) {
      bulkOps.push(...progressBulkOps);
    }

    const sortedProgressBadges = [...badgeObjects]
      .sort((a, b) => (b.progress || 0) - (a.progress || 0))
      .slice(0, 3);

    perPlayerEarned.push({
      userId: playerIdStr,
      badges: sortedProgressBadges,
    });

    // Calculate XP and queue user totalXP increment (helpers kept for future use)
    try {
      const roundXPResult = calculateRoundXP(playerResults, holes);
      const bonuses = await getXPBonuses(db, playerId, courseId, scorecardId, scorecard);

      let roundXP = roundXPResult.baseXP + roundXPResult.hotStreakXP;
      if (roundXPResult.cleanRound) roundXP += XP_BONUS.cleanRound;
      if (roundXPResult.noOB) roundXP += XP_BONUS.noOB;

      let multiplier = 1;
      if (bonuses.verifiedRound) multiplier += XP_MULTIPLIER.verifiedRound;
      if (bonuses.weeklyStreak) multiplier += XP_MULTIPLIER.weeklyStreak;
      const totalRoundXP = Math.round(roundXP * multiplier) + (bonuses.newCourse ? XP_BONUS.newCourse : 0);

      let badgeTierXP = 0;
      for (const bo of badgeObjects) {
        if (bo.tierIncremented && bo.currentTier >= 0) {
          badgeTierXP += XP_TIER[Math.min(bo.currentTier, XP_TIER.length - 1)] || XP_TIER[XP_TIER.length - 1];
        }
      }

      const totalXP = totalRoundXP + badgeTierXP;
      xpIncrements.push({ userId: playerId, totalXP });
    } catch (xpErr) {
      console.error(`[searchForEarnedBadges] XP calculation for player ${playerIdStr}:`, xpErr);
    }
  }


  for (const doc of docsToInsert) {
    bulkOps.push({
      insertOne: {
        document: doc
      }
    });
  }

  if (bulkOps.length > 0) {
    try {
      await progressCollection.bulkWrite(bulkOps, { ordered: false });
    } catch (error) {

      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  if (xpIncrements.length > 0) {
    try {
      const userXPTotalsCollection = db.collection('userXPTotals');
      const xpIncrementOps = xpIncrements.map(({ userId, totalXP }) => {
        // Ensure userId is converted to ObjectId
        const userIdObj = userId instanceof ObjectId ? userId : (ObjectId.isValid(userId) ? new ObjectId(userId) : userId);
        return {
          updateOne: {
            filter: { _id: userIdObj },
            update: {
              $inc: { totalXP },
              $setOnInsert: { _id: userIdObj }
            },
            upsert: true
          }
        };
      });
      await userXPTotalsCollection.bulkWrite(xpIncrementOps);
      console.log(`\n📊 [searchForEarnedBadges] Incremented totalXP for ${xpIncrementOps.length} user(s) in userXPTotals`);
    } catch (xpSaveErr) {
      console.error('[searchForEarnedBadges] Failed to increment user totalXP:', xpSaveErr);
    }
  }

  console.log(`\n✅ [searchForEarnedBadges] Completed. Returning results for ${perPlayerEarned.length} player(s)`);
  return perPlayerEarned;
};

/**
 * Check historical badges using a single aggregate query with $facet.
 *
 * For historical badges we want to do as much work as possible inside MongoDB's
 * aggregation pipeline instead of fetching all scorecards and post‑processing them
 * in Node. This function runs ALL historical badges in a single aggregate query
 * using $facet for parallel execution.
 *
 * Convention for historical badges:
 * - `badgeDef.condition` (string) contains a function body that, when executed,
 *   returns an object describing how to build the facet pipeline stages.
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
 *       // Build facet pipeline stages (without the initial $match, which is shared).
 *       // This counts how many completed scorecards this player has on the CURRENT course.
 *       const facetPipeline = [
 *         {
 *           $match: {
 *             courseId: courseId  // additional filter specific to this badge
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
 *         facetPipeline,  // stages to run inside the $facet (without shared $match)
 *         valueField: 'value', // field to read from the first facet result document
 *         asProgress: true     // use this numeric value as progress for this badge
 *       };
 *     `
 * 
 * Note: All historical badges are executed in a single aggregate query using $facet,
 * which allows MongoDB to process all badges in parallel for better performance.
 *   }
 *
 * The placeholder above is just an example; more historical badges can store their
 * own aggregate‑building snippets in `condition` using the same pattern.
 * 
 * Example for "losses against friends" badge (using $lookup to get friends in the aggregate):
 *
 *   {
 *     id: 'losses_against_friends',
 *     name: 'Humble Friend',
 *     requiresHistoricalData: true,
 *     isUnique: false,
 *     type: 'tiered',
 *     tierThresholds: [5, 10, 25],
 *     condition: `
 *       // Build pipeline that uses $lookup to get friends within the aggregate
 *       const facetPipeline = [
 *         // First, lookup friends (both directions: from->to and to->from)
 *         {
 *           $lookup: {
 *             from: 'friends',
 *             let: { playerId: playerIdStr },
 *             pipeline: [
 *               {
 *                 $match: {
 *                   $expr: {
 *                     $and: [
 *                       { $eq: ['$status', 'accepted'] },
 *                       {
 *                         $or: [
 *                           { $eq: [{ $toString: '$from' }, '$$playerId'] },
 *                           { $eq: [{ $toString: '$to' }, '$$playerId'] }
 *                         ]
 *                       }
 *                     ]
 *                   }
 *                 }
 *               },
 *               {
 *                 $project: {
 *                   friendId: {
 *                     $cond: {
 *                       if: { $eq: [{ $toString: '$from' }, '$$playerId'] },
 *                       then: { $toString: '$to' },
 *                       else: { $toString: '$from' }
 *                     }
 *                   }
 *                 }
 *               }
 *             ],
 *             as: 'friends'
 *           }
 *         },
 *         // Extract friend IDs into an array
 *         {
 *           $addFields: {
 *             friendIds: '$friends.friendId'
 *           }
 *         },
 *         // Unwind results to work with individual result entries
 *         { $unwind: '$results' },
 *         // Group by scorecard and player to calculate total scores
 *         {
 *           $group: {
 *             _id: {
 *               scorecardId: '$_id',
 *               playerId: '$results.playerId'
 *             },
 *             totalScore: { $sum: '$results.score' },
 *             scorecardId: { $first: '$_id' },
 *             friendIds: { $first: '$friendIds' }
 *           }
 *         },
 *         // Group by scorecard to get all player scores together
 *         // Note: playerId is ObjectId (from results), friendIds are ObjectIds - no conversion needed
 *         {
 *           $group: {
 *             _id: '$scorecardId',
 *             playerScores: {
 *               $push: {
 *                 playerId: '$_id.playerId', // ObjectId, matches friendIds (ObjectIds)
 *                 totalScore: '$totalScore'
 *               }
 *             },
 *             friendIds: { $first: '$friendIds' }
 *           }
 *         },
 *         // Filter to only scorecards where at least one friend played
 *         {
 *           $match: {
 *             $expr: {
 *               $gt: [
 *                 {
 *                   $size: {
 *                     $setIntersection: ['$playerScores.playerId', '$friendIds']
 *                   }
 *                 },
 *                 0
 *               ]
 *             }
 *           }
 *         },
 *         // Calculate if player lost to any friend
 *         {
 *           $addFields: {
 *             playerScore: {
 *               $let: {
 *                 vars: {
 *                   player: {
 *                     $arrayElemAt: [
 *                       {
 *                         $filter: {
 *                           input: '$playerScores',
 *                           as: 'ps',
 *                           cond: { $eq: ['$$ps.playerId', playerIdObj] } // Use ObjectId
 *                         }
 *                       },
 *                       0
 *                     ]
 *                   }
 *                 },
 *                 in: '$$player.totalScore'
 *               }
 *             },
 *             friendScores: {
 *               $filter: {
 *                 input: '$playerScores',
 *                 as: 'ps',
 *                 cond: {
 *                   $and: [
 *                     { $ne: ['$$ps.playerId', playerIdObj] }, // Use ObjectId
 *                     { $in: ['$$ps.playerId', '$friendIds'] } // Both ObjectIds, no conversion
 *                   ]
 *                 }
 *               }
 *             }
 *           }
 *         },
 *         // Check if player lost (higher score = worse in disc golf)
 *         {
 *           $addFields: {
 *             lost: {
 *               $cond: {
 *                 if: { $gt: [{ $size: '$friendScores' }, 0] },
 *                 then: {
 *                   $gt: [
 *                     '$playerScore',
 *                     { $min: '$friendScores.totalScore' }
 *                   ]
 *                 },
 *                 else: false
 *               }
 *             }
 *           }
 *         },
 *         // Count scorecards where player lost
 *         {
 *           $match: { lost: true }
 *         },
 *         {
 *           $group: {
 *             _id: null,
 *             value: { $sum: 1 }
 *           }
 *         }
 *       ];
 *       
 *       return {
 *         facetPipeline,
 *         valueField: 'value',
 *         asProgress: true
 *       };
 *     `
 *   }
 */
const checkHistoricalBadges = async (db, playerId, historicalBadges, courseId, scorecardId = null) => {
  console.log(`\n🔍 [checkHistoricalBadges] Checking ${historicalBadges.length} historical badge(s) for player ${playerId}`);

  const scorecardsCollection = db.collection('scorecards');
  const playerIdStr = String(playerId);
  const playerIdObj = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;
  const courseIdStr = courseId ? String(courseId) : null;

  const results = [];

  // Helper: Build aggregate configuration from a historical badge's condition string.
  // The condition string is treated as the body of a function with the following signature:
  //   (playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId) => ({
  //      facetPipeline: [...],  // stages to run inside $facet (without shared $match)
  //      valueField: 'value',
  //      asProgress: true|false
  //   })
  const buildHistoricalAggregateFromCondition = (badgeDef) => {
    if (!badgeDef.condition || typeof badgeDef.condition !== 'string') {
      return null;
    }

    let trimmed = badgeDef.condition.trim();
    
    // Handle arrow function syntax: (params) => { ... } or params => { ... }
    const arrowFunctionMatch = trimmed.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\{/);
    if (arrowFunctionMatch) {
      // Extract body from arrow function - find matching outer braces
      let braceCount = 0;
      let functionStart = -1;
      let functionEnd = -1;
      
      // Find the opening brace after the arrow
      const arrowIndex = trimmed.indexOf('=>');
      if (arrowIndex !== -1) {
        for (let i = arrowIndex; i < trimmed.length; i++) {
          if (trimmed[i] === '{') {
            if (braceCount === 0) {
              functionStart = i;
            }
            braceCount++;
          } else if (trimmed[i] === '}') {
            braceCount--;
            if (braceCount === 0 && functionStart !== -1) {
              functionEnd = i;
              break;
            }
          }
        }
      }
      
      if (functionStart !== -1 && functionEnd !== -1) {
        trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
      }
    } else {
      // Check if it looks like a function declaration: function (...) { ... }
      const functionDeclMatch = trimmed.match(/^\s*function\s*\([^)]*\)\s*\{/);
      if (functionDeclMatch) {
        // Find matching outer braces for function declaration
        let braceCount = 0;
        let functionStart = -1;
        let functionEnd = -1;
        
        const funcIndex = trimmed.indexOf('function');
        if (funcIndex !== -1) {
          for (let i = funcIndex; i < trimmed.length; i++) {
            if (trimmed[i] === '{') {
              if (braceCount === 0) {
                functionStart = i;
              }
              braceCount++;
            } else if (trimmed[i] === '}') {
              braceCount--;
              if (braceCount === 0 && functionStart !== -1) {
                functionEnd = i;
                break;
              }
            }
          }
        }
        
        if (functionStart !== -1 && functionEnd !== -1) {
          trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
        }
      }
      // Otherwise, treat the entire string as the body (no wrapper)
    }
    
    const body = trimmed;

    try {
      // Debug: log the body being executed
      if (process.env.DEBUG_BADGE_CONDITIONS) {
        console.log(`\n=== Badge: ${badgeDef.name || badgeDef.id} ===`);
        console.log('Body length:', body.length);
        console.log('Body preview:', body.substring(0, 200));
      }
      
      const fn = new Function(
        'playerIdObj',
        'playerIdStr',
        'courseId',
        'courseIdStr',
        'ObjectId',
        body
      );
      const config = fn(playerIdObj, playerIdStr, courseId, courseIdStr, ObjectId);

      // Support both 'pipeline' (legacy) and 'facetPipeline' (new)
      const facetPipeline = config.facetPipeline || config.pipeline;
      
      if (!config || !Array.isArray(facetPipeline) || !config.valueField) {
        return null;
      }

      return {
        facetPipeline,
        valueField: config.valueField,
        asProgress: config.asProgress !== false // default to true if not specified
      };
    } catch (err) {
      console.error(`Failed to build historical aggregate for badge ${badgeDef.name}:`, err);
      return null;
    }
  };

  // Build configurations for all badges first
  const badgeConfigs = [];
  for (const badgeDef of historicalBadges) {
    const aggConfig = buildHistoricalAggregateFromCondition(badgeDef);
    if (aggConfig) {
      badgeConfigs.push({
        badgeDef,
        aggConfig
      });
    }
  }

  // If no badges have valid configurations, return early
  if (badgeConfigs.length === 0) {
    console.log(`\n⚠️  [checkHistoricalBadges] No badges with valid configurations, returning empty results`);
    return results;
  }

  console.log(`\n✅ [checkHistoricalBadges] ${badgeConfigs.length} badge(s) ready for aggregation`);

  // Build the shared match stage (common to all badges)
  // Note: Both creatorId and results.playerId are stored as ObjectIds
  // Exclude the current scorecard from historical checks
  const sharedMatch = {
    status: 'completed',
    $or: [
      { creatorId: playerIdObj },
      { 'results.playerId': playerIdObj } // results.playerId is ObjectId
    ]
  };

  // Build the $facet stage with one facet per badge
  const facets = {};
  const badgeIdToConfig = {};
  
  for (const { badgeDef, aggConfig } of badgeConfigs) {
    const facetKey = badgeDef.id; // Use badge ID as the facet key
    facets[facetKey] = [
      // Add badge-specific stages after the shared match
      ...aggConfig.facetPipeline
    ];
    badgeIdToConfig[facetKey] = { badgeDef, aggConfig };
  }

  // Build the $project stage to extract values from each facet.
  // Simpler & more robust: we assume each facet outputs documents shaped like { value: <number> }.
  // Then we just take the first document's `value` field or 0 if missing.
  const projectFields = {};
  for (const facetKey of Object.keys(facets)) {
    projectFields[facetKey] = {
      $ifNull: [
        { $arrayElemAt: [`$${facetKey}.value`, 0] },
        0
      ]
    };
  }

  // Build the complete aggregation pipeline
  // 1) Match this player's completed scorecards
  // 2) Lookup friends once (for ALL historical badges)
  // 3) Add shared friendIds field
  // 4) Run all badge-specific facets in parallel
  const pipeline = [
    {
      $match: sharedMatch
    },
    // Lookup accepted friends for this player (both directions)
    // Note: friends.to, friends.from, and results.playerId are all ObjectIds - no conversions needed
    {
      $lookup: {
        from: 'friends',
        let: { playerId: playerIdObj }, // Use ObjectId for comparison
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$status', 'accepted'] },
                  {
                    $or: [
                      { $eq: ['$from', '$$playerId'] }, // Direct ObjectId comparison
                      { $eq: ['$to', '$$playerId'] } // Direct ObjectId comparison
                    ]
                  }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              friendId: {
                $cond: {
                  if: { $eq: ['$from', '$$playerId'] },
                  then: '$to', // Return ObjectId directly
                  else: '$from' // Return ObjectId directly
                }
              }
            }
          }
        ],
        as: 'friends'
      }
    },
    // Expose list of friendIds on every scorecard document so all facets can reuse it
    {
      $addFields: {
        friendIds: '$friends.friendId',
        // Debug: log friend lookup for Friendly Fire debugging
        _debugFriendLookup: {
          playerId: { $toString: playerIdObj },
          friendsFound: { $size: { $ifNull: ['$friends', []] } },
          friendIdsArray: '$friends.friendId'
        }
      }
    },
    {
      $facet: facets
    },
    {
      $project: projectFields
    }
  ];

  try {
    // Debug: Log friend lookup results for Friendly Fire badge
    if (badgeConfigs.some(c => c.badgeDef.id === 'friendly_fire')) {
      const debugPipeline = [
        { $match: sharedMatch },
        {
          $lookup: {
            from: 'friends',
            let: { playerId: playerIdObj },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$status', 'accepted'] },
                      {
                        $or: [
                          { $eq: ['$from', '$$playerId'] },
                          { $eq: ['$to', '$$playerId'] }
                        ]
                      }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  from: { $toString: '$from' },
                  to: { $toString: '$to' },
                  friendId: {
                    $cond: {
                      if: { $eq: ['$from', '$$playerId'] },
                      then: { $toString: '$to' },
                      else: { $toString: '$from' }
                    }
                  }
                }
              }
            ],
            as: 'friends'
          }
        },
        { $limit: 1 }
      ];
      const debugResult = await scorecardsCollection.aggregate(debugPipeline).toArray();
      if (debugResult.length > 0) {
        console.log(`\n🔍 [DEBUG] Friend lookup for player ${playerIdStr}:`);
        console.log(`   Friends found: ${debugResult[0].friends?.length || 0}`);
        debugResult[0].friends?.forEach((f, idx) => {
          console.log(`   Friend ${idx + 1}: from=${f.from}, to=${f.to}, friendId=${f.friendId}`);
        });
      } else {
        console.log(`\n🔍 [DEBUG] Friend lookup for player ${playerIdStr}: No scorecards found`);
      }
    }
    
    // Execute single aggregate query for all badges
    const aggResult = await scorecardsCollection.aggregate(pipeline).toArray();
    const resultDoc = aggResult[0] || {};

    // Process results for each badge
    for (const facetKey of Object.keys(facets)) {
      const { badgeDef, aggConfig } = badgeIdToConfig[facetKey];
      const value = resultDoc[facetKey];

      // Log Friendly Fire badge result for verification
      if (badgeDef.id === 'friendly_fire') {
        console.log(`\n🎯 [checkHistoricalBadges] Friendly Fire badge result: ${value} (${value === 0 ? 'no losses found' : `${value} loss(es) found`})`);
      }

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
    }

  } catch (error) {
    console.error(`\n❌ [checkHistoricalBadges] Error executing historical badges aggregate:`, error);
    console.error(`   Error stack:`, error.stack);
    // Fallback: try individual badges if the combined query fails
    for (const { badgeDef, aggConfig } of badgeConfigs) {
      try {
        const fallbackPipeline = [
          { $match: sharedMatch },
          ...aggConfig.facetPipeline
        ];
        const fallbackResult = await scorecardsCollection.aggregate(fallbackPipeline).toArray();
        const firstDoc = fallbackResult[0] || {};
        const value = firstDoc[aggConfig.valueField];

        if (value !== undefined && value !== null && value !== 0 && value !== false) {
          if (badgeDef.isUnique && !aggConfig.asProgress) {
            results.push({
              badgeId: badgeDef.id,
              name: badgeDef.name,
              earned: true,
              courseId: courseId || null,
              layoutId: null
            });
          } else {
            results.push({
              badgeId: badgeDef.id,
              name: badgeDef.name,
              progress: value,
              courseId: courseId || null,
              layoutId: null
            });
          }
        }
      } catch (fallbackError) {
        console.error(`Error checking historical badge ${badgeDef.name} (fallback):`, fallbackError);
      }
    }
  }

  return results;
};

// Execute badge condition function
const executeBadgeCondition = (badgeDef, playerResults, layout, { allOtherPlayersResults }) => {

  if (!badgeDef.condition) return false;
  
  try {
    if (typeof badgeDef.condition === 'string') {

      const trimmed = badgeDef.condition.trim();
      const functionStart = trimmed.indexOf('{');
      const functionEnd = trimmed.lastIndexOf('}');
      
      if (functionStart !== -1 && functionEnd !== -1) {
        const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
        
        const func = new Function('results', 'layout', 'allOtherPlayersResults', functionBody);
        const result = func(playerResults, layout, allOtherPlayersResults);
        return result;
      } else {
        console.error('Invalid function format in condition');
        return false;
      }
    }
    
    if (typeof badgeDef.condition === 'function') {
      return badgeDef.condition(playerResults, layout, allOtherPlayersResults);
    }
    
    return false;
  } catch (error) {
    console.error(`Error executing condition for ${badgeDef.name}:`, error);
    return false;
  }
};

const updateBadgeProgress = (userId, progressForPlayer, badgeDefinitions, courseId, layoutId, scorecardId, existingProgressMap = {}) => {
  if (!progressForPlayer || progressForPlayer.length === 0) return { bulkOps: [], badgeObjects: [] };

  // Build bulk write operations for all badges
  const bulkOps = [];
  const badgeObjects = [];

  for (const progressData of progressForPlayer) {
    const badgeDef = badgeDefinitions.find(b => b.id === progressData.badgeId);
    if (!badgeDef || !badgeDef.tierThresholds) continue;
    
    // Get existing progress values
    const existing = existingProgressMap[progressData.badgeId] || { currentTier: -1, totalProgress: 0 };
    
    // Calculate new totalProgress (same logic as MongoDB pipeline)
    // trackTierThresholdZync: true -> Points cannot be accumulated. Tier only levels up if you get
    //   the points needed during ONE round. totalProgress = current round's progress only.
    // trackTierThresholdZync: false -> Points accumulate across rounds. totalProgress accumulates.
    const newTotalProgress = badgeDef.trackTierThresholdZync
      ? progressData.progress
      : existing.totalProgress + progressData.progress;
    
    // Calculate new tier based on totalProgress
    // For trackTierThresholdZync: true, this checks if current round's progress meets a threshold
    // For trackTierThresholdZync: false, this checks if accumulated progress meets a threshold
    const newTier = calculateCurrentTier(newTotalProgress, badgeDef.tierThresholds);
    const newCurrentTier = Math.max(existing.currentTier, newTier);

    // Build aggregation pipeline for update that handles both insert and update cases
    // Calculate new totalProgress in MongoDB pipeline (same logic as in-memory calculation above)
    // trackTierThresholdZync: true -> Set totalProgress to current round's progress (no accumulation)
    // trackTierThresholdZync: false -> Add current round's progress to existing totalProgress (accumulation)
    const totalProgressUpdate = badgeDef.trackTierThresholdZync
      ? progressData.progress
      : { $add: [{ $ifNull: ['$totalProgress', 0] }, progressData.progress] };

    // Build tier calculation pipeline - iterate through thresholds from highest to lowest
    const tierCalculation = buildTierCalculationPipeline(badgeDef.tierThresholds);

    // Build the update pipeline
    const pipeline = [
      {
        $set: {
          // Capture oldCurrentTier BEFORE updating totalProgress to ensure we compare against previous tier
          oldCurrentTier: { $ifNull: ['$currentTier', -1] },
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
          currentTier: { $max: ['$oldCurrentTier', '$newTier'] }
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
          // trackedThresholds: For badges with trackTierThresholdZync: true, track which tier thresholds
          // have been achieved. Only add tiers >= 0 (actual achieved tiers, not -1).
          trackedThresholds: badgeDef.trackTierThresholdZync
            ? {
                $cond: {
                  if: { $gte: ['$newTier', 0] },
                  then: { $setUnion: [{ $ifNull: ['$trackedThresholds', []] }, ['$newTier']] },
                  else: { $ifNull: ['$trackedThresholds', []] }
                }
              }
            : { $ifNull: ['$trackedThresholds', []] }
        }
      },
      {
        $set: {
          tierProgress: {
            $cond: {
              if: { $gt: ['$newTier', '$oldCurrentTier'] },
              then: {
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
              },
              else: { $ifNull: ['$tierProgress', []] }
            }
          }
        }
      },
      {
        $unset: 'newTier'
      },
      {
        $unset: 'oldCurrentTier'
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

    // Compile badge object for scorecard update (with currentTier and totalProgress)
    const badgeObject = {
      badgeId: progressData.badgeId,
      badgeName: progressData.badgeName,
      progress: progressData.progress,
      courseId: progressData.courseId,
      layoutId: progressData.layoutId,
      tierThresholds: badgeDef.tierThresholds,
      tierIncremented: newCurrentTier > existing.currentTier,
      currentTier: newCurrentTier,
      previousTotalProgress: existing.totalProgress,
      totalProgress: newTotalProgress
    };
    badgeObjects.push(badgeObject);

    bulkOps.push({
      updateOne: {
        filter: query,
        update: pipeline,
        upsert: true,
        setOnInsert: setOnInsert
      }
    });
  }

  return { bulkOps, badgeObjects };
};

// Build tier calculation pipeline that finds the highest tier threshold met
const buildTierCalculationPipeline = (thresholds) => {
  // Build a series of $cond expressions to find the highest tier
  // We check each threshold and use $max to keep the highest tier that matches
  // This ensures that if multiple thresholds are met, we get the highest one
  
  // Start with -1 (no tier)
  let tierCalculation = -1;
  
  // Build nested $cond expressions: for each threshold, if progress >= threshold[i],
  // use $max to keep the higher of current tier or i
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (i === thresholds.length - 1) {
      // First iteration - base case
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          i,
          -1
        ]
      };
    } else {
      // Subsequent iterations - use $max to keep the highest tier
      tierCalculation = {
        $cond: [
          { $gte: ['$totalProgress', thresholds[i]] },
          { $max: [tierCalculation, i] }, // Keep the higher tier
          tierCalculation // Keep current tier if threshold not met
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
      $group: {
        _id: "$badgeId",
        doc: { $first: "$$ROOT" } // Take first document if duplicates exist
      }
    },
    { $replaceRoot: { newRoot: "$doc" } }, // Restore document structure
    {
      $lookup: {
        from: "badgeDefinitions",
        localField: "badgeId",
        foreignField: "id",
        as: "badgeDef"
      }
    },
    {
      $addFields: {
        badgeDef: { $arrayElemAt: ["$badgeDef", 0] }
      }
    },
    // Filter out documents where badgeDef lookup failed (badge definition doesn't exist)
    { $match: { badgeDef: { $ne: null } } },
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
  getUserAllBadges,
  checkHistoricalBadges // Export for testing
};