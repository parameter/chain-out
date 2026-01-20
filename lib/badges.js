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
  const progressCollection = db.collection('userBadgeProgress');
  const scorecardsCollection = db.collection('scorecards');

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

  const badgeDefinitions = await getBadgeDefinitions(db);
  console.log(`\n📋 [searchForEarnedBadges] Loaded ${badgeDefinitions.length} badge definition(s)`);
  
  // Debug: Check for Friendly Fire badge specifically
  const friendlyFireBadge = badgeDefinitions.find(b => 
    b.id === 'friendly_fire' || 
    b.id === 'Friendly Fire' || 
    b.name === 'Friendly Fire' ||
    b.name === 'friendly_fire'
  );
  if (friendlyFireBadge) {
    console.log(`\n🔍 [searchForEarnedBadges] Found Friendly Fire badge:`);
    console.log(`   ID: ${friendlyFireBadge.id}`);
    console.log(`   Name: ${friendlyFireBadge.name}`);
    console.log(`   requiresHistoricalData: ${friendlyFireBadge.requiresHistoricalData}`);
    console.log(`   Has condition: ${!!friendlyFireBadge.condition}`);
    console.log(`   Condition type: ${typeof friendlyFireBadge.condition}`);
    if (friendlyFireBadge.condition) {
      console.log(`   Condition length: ${friendlyFireBadge.condition.length}`);
      console.log(`   Condition preview: ${friendlyFireBadge.condition.substring(0, 100)}...`);
    }
  } else {
    console.log(`\n⚠️  [searchForEarnedBadges] Friendly Fire badge NOT FOUND in badge definitions!`);
    console.log(`   Searching for badges with 'friendly' or 'fire' in name/id...`);
    const similarBadges = badgeDefinitions.filter(b => 
      (b.name && (b.name.toLowerCase().includes('friendly') || b.name.toLowerCase().includes('fire'))) ||
      (b.id && (b.id.toLowerCase().includes('friendly') || b.id.toLowerCase().includes('fire')))
    );
    if (similarBadges.length > 0) {
      similarBadges.forEach(b => {
        console.log(`     Found: ${b.name || b.id} (id: ${b.id}, requiresHistoricalData: ${b.requiresHistoricalData})`);
      });
    } else {
      console.log(`     No similar badges found`);
    }
  }
  
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

  const perPlayerEarned = {};
  const docsToInsert = [];
  const bulkOps = [];

  const courseIdObj = ObjectId.isValid(courseId) ? new ObjectId(courseId) : courseId;

  for (const playerIdStr of uniquePlayerIds) {

    const playerResults = results.filter(r => String(r.playerId) === playerIdStr);
    const allOtherPlayersResults = results.filter(r => String(r.playerId) !== playerIdStr);
    const playerId = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;

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
      console.log(`\n📊 [searchForEarnedBadges] Checking ${historicalBadges.length} historical badge(s) for player ${playerIdStr}`);
      try {
        const historicalResults = await checkHistoricalBadges(db, playerId, historicalBadges, courseId);
        
        console.log(`\n📊 [searchForEarnedBadges] Historical badge results: ${historicalResults.length}`);
        historicalResults.forEach(r => {
          console.log(`   - ${r.name || r.badgeId}: ${r.progress !== undefined ? `progress=${r.progress}` : `earned=${r.earned}`}`);
        });
        
        // Merge historical badge results into earnedForPlayer and progressForPlayer
        for (const badgeResult of historicalResults) {
          if (badgeResult.earned) {
            console.log(`   ✅ Adding to earnedForPlayer: ${badgeResult.name}`);
            earnedForPlayer.push({
              name: badgeResult.name,
              courseId: badgeResult.courseId || courseId,
              badgeId: badgeResult.badgeId,
              type: 'unique',
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          }
          
          if (badgeResult.progress !== undefined && badgeResult.progress !== false && badgeResult.progress !== 0) {
            console.log(`   ✅ Adding to progressForPlayer: ${badgeResult.name} (progress: ${badgeResult.progress})`);
            progressForPlayer.push({
              badgeId: badgeResult.badgeId,
              badgeName: badgeResult.name,
              progress: badgeResult.progress,
              courseId: badgeResult.courseId || courseId,
              layoutId: badgeResult.layoutId || (layout && (layout._id || layout.id))
            });
          } else {
            console.log(`   ⏭️  Skipping ${badgeResult.name} (progress: ${badgeResult.progress}, earned: ${badgeResult.earned})`);
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

    const progressBulkOps = updateBadgeProgress(playerId, progressForPlayer, badgeDefinitions, courseId, (layout._id || layout.id), scorecardId);
    if (progressBulkOps && progressBulkOps.length > 0) {
      bulkOps.push(...progressBulkOps);
    }

    perPlayerEarned[playerIdStr] = {
      unique: earnedForPlayer.map(b => b.name),
      progress: progressForPlayer.map(p => p.badgeName)
    };
    
    console.log(`\n📊 [searchForEarnedBadges] Player ${playerIdStr} results:`);
    console.log(`   Unique badges: ${earnedForPlayer.length} (${earnedForPlayer.map(b => b.name).join(', ')})`);
    console.log(`   Progress badges: ${progressForPlayer.length} (${progressForPlayer.map(p => p.badgeName).join(', ')})`);
  }

  console.log(`\n💾 [searchForEarnedBadges] Preparing bulk operations:`);
  console.log(`   Documents to insert: ${docsToInsert.length}`);
  console.log(`   Bulk operations: ${bulkOps.length}`);

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

  console.log(`\n✅ [searchForEarnedBadges] Completed. Returning results for ${Object.keys(perPlayerEarned).length} player(s)`);
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
 *         {
 *           $group: {
 *             _id: '$scorecardId',
 *             playerScores: {
 *               $push: {
 *                 playerId: '$_id.playerId',
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
 *                           cond: { $eq: ['$$ps.playerId', playerIdStr] }
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
 *                     { $ne: ['$$ps.playerId', playerIdStr] },
 *                     { $in: ['$$ps.playerId', '$friendIds'] }
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
const checkHistoricalBadges = async (db, playerId, historicalBadges, courseId) => {
  console.log('\n🔍 [checkHistoricalBadges] Starting historical badge check');
  console.log(`   Player ID: ${playerId}`);
  console.log(`   Course ID: ${courseId}`);
  console.log(`   Historical badges to check: ${historicalBadges.length}`);
  historicalBadges.forEach(b => {
    console.log(`     - ${b.name || b.id} (id: ${b.id}, requiresHistoricalData: ${b.requiresHistoricalData})`);
  });

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
    console.log(`\n📋 [checkHistoricalBadges] Building config for badge: ${badgeDef.name || badgeDef.id}`);
    const aggConfig = buildHistoricalAggregateFromCondition(badgeDef);
    if (aggConfig) {
      console.log(`   ✅ Config built successfully`);
      console.log(`      - facetPipeline stages: ${aggConfig.facetPipeline.length}`);
      console.log(`      - valueField: ${aggConfig.valueField}`);
      console.log(`      - asProgress: ${aggConfig.asProgress}`);
      badgeConfigs.push({
        badgeDef,
        aggConfig
      });
    } else {
      console.log(`   ❌ Failed to build config (check condition string)`);
    }
  }

  // If no badges have valid configurations, return early
  if (badgeConfigs.length === 0) {
    console.log(`\n⚠️  [checkHistoricalBadges] No badges with valid configurations, returning empty results`);
    return results;
  }

  console.log(`\n✅ [checkHistoricalBadges] ${badgeConfigs.length} badge(s) ready for aggregation`);

  // Build the shared match stage (common to all badges)
  const sharedMatch = {
    status: 'completed',
    $or: [
      { creatorId: playerIdObj },
      { 'results.playerId': playerIdStr }
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
    {
      $lookup: {
        from: 'friends',
        let: { playerId: playerIdStr },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$status', 'accepted'] },
                  {
                    $or: [
                      { $eq: [{ $toString: '$from' }, '$$playerId'] },
                      { $eq: [{ $toString: '$to' }, '$$playerId'] }
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
                  if: { $eq: [{ $toString: '$from' }, '$$playerId'] },
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
    // Expose list of friendIds on every scorecard document so all facets can reuse it
    {
      $addFields: {
        friendIds: '$friends.friendId'
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
    console.log(`\n🔍 [checkHistoricalBadges] Executing aggregate pipeline...`);
    console.log(`   Pipeline stages: ${pipeline.length}`);
    console.log(`   Facets: ${Object.keys(facets).join(', ')}`);
    
    // Execute single aggregate query for all badges
    const aggResult = await scorecardsCollection.aggregate(pipeline).toArray();
    const resultDoc = aggResult[0] || {};

    console.log(`\n📊 [checkHistoricalBadges] Aggregate result:`);
    console.log(`   Result documents: ${aggResult.length}`);
    console.log(`   Result doc keys: ${Object.keys(resultDoc).join(', ')}`);
    console.log(`   Result doc values:`, JSON.stringify(resultDoc, null, 2));

    // Process results for each badge
    for (const facetKey of Object.keys(facets)) {
      const { badgeDef, aggConfig } = badgeIdToConfig[facetKey];
      const value = resultDoc[facetKey];

      console.log(`\n🎯 [checkHistoricalBadges] Processing badge: ${badgeDef.name || badgeDef.id}`);
      console.log(`   Facet key: ${facetKey}`);
      console.log(`   Value from aggregate: ${value} (type: ${typeof value})`);

      if (value === undefined || value === null || value === 0 || value === false) {
        console.log(`   ⏭️  Skipping (value is falsy)`);
        continue;
      }

      if (badgeDef.isUnique && !aggConfig.asProgress) {
        // Treat this as a unique, earned‑once historical badge
        console.log(`   ✅ Adding as unique badge (earned: true)`);
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          earned: true,
          courseId: courseId || null,
          layoutId: null
        });
      } else {
        // Treat this as progressive – use the aggregate value as progress
        console.log(`   ✅ Adding as progressive badge (progress: ${value})`);
        results.push({
          badgeId: badgeDef.id,
          name: badgeDef.name,
          progress: value,
          courseId: courseId || null,
          layoutId: null
        });
      }
    }

    console.log(`\n✅ [checkHistoricalBadges] Completed successfully`);
    console.log(`   Results count: ${results.length}`);
    results.forEach(r => {
      console.log(`     - ${r.name || r.badgeId}: ${r.progress !== undefined ? `progress=${r.progress}` : `earned=${r.earned}`}`);
    });
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

  console.log(`\n🏁 [checkHistoricalBadges] Returning ${results.length} result(s)`);
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
  getUserAllBadges,
  checkHistoricalBadges // Export for testing
};