/**
 * Test for ObjectId/String comparison fix in badge conditions
 * 
 * This test is READ-ONLY - it does not insert, update, or delete any data.
 * It only reads from the database to verify the aggregation pipeline works correctly.
 */

// Load environment variables
require('dotenv').config();

const { initializeDatabase, getDatabase, closeDatabase } = require('./config/database');
const { ObjectId } = require('mongodb');
const { checkHistoricalBadges } = require('./lib/badges');

// Test scorecard data (used for reference/analysis only, not inserted)
const testScorecard = {
  "_id": new ObjectId("696f8a7c34ac06e0eb846a1f"),
  "creatorId": new ObjectId("68da392e41254148ddea8883"),
  "courseId": new ObjectId("68da917b30d97419bf9cb74a"),
  "layout": {
    "type": "PUBLIC",
    "id": "d432665e-1b83-4eea-bba9-58646711207e",
    "name": "Main",
    "difficulty": "INTERMEDIATE",
    "payToPlay": null,
    "course": {
      "name": "Nykvarn DiscGolfPark",
      "id": "71adcf5c-9570-465e-814e-5244febc9f8d"
    },
    "latestVersion": {
      "id": "e9200249-013b-420a-9f54-c1052d9c468f",
      "createdAt": "2024-07-25T07:40:40.252Z",
      "holes": [
        { "id": "3afd80c4-89e7-4d1d-9512-099058e87bc7", "number": 1, "par": 3, "length": 60, "measureInMeters": true },
        { "id": "1647c57b-c987-4044-911d-dc1bae901cc5", "number": 2, "par": 3, "length": 72, "measureInMeters": true },
        { "id": "5c08a083-526c-4172-9c2a-33c48b0dd595", "number": 3, "par": 3, "length": 75, "measureInMeters": true },
        { "id": "e93decb2-f1ab-48d4-a532-c5cca4e67ce3", "number": 4, "par": 3, "length": 69, "measureInMeters": true },
        { "id": "43cdd07c-c40f-457e-9336-48b9afd087ca", "number": 5, "par": 3, "length": 125, "measureInMeters": true },
        { "id": "764eda90-377b-41bb-bd3f-143e6501f42b", "number": 6, "par": 3, "length": 102, "measureInMeters": true },
        { "id": "cb415a2b-872b-4bc7-bd02-76ee6dd0ee40", "number": 7, "par": 4, "length": 149, "measureInMeters": true },
        { "id": "1699d360-025c-4a79-a1f6-002f621e126c", "number": 8, "par": 3, "length": 66, "measureInMeters": true },
        { "id": "3b6a42ed-7ab2-464e-b140-2a0d79b32f82", "number": 9, "par": 3, "length": 80, "measureInMeters": true },
        { "id": "9f50058c-3804-4a59-856f-1556c2039009", "number": 10, "par": 3, "length": 65, "measureInMeters": true },
        { "id": "bd57cb23-1c78-4a98-abe1-3c928665a219", "number": 11, "par": 3, "length": 84, "measureInMeters": true },
        { "id": "c32b580f-1ba9-4668-806c-c89ed596e540", "number": 12, "par": 4, "length": 142, "measureInMeters": true }
      ]
    }
  },
  "results": [
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 1, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 1, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 2, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 2, "score": 2 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 3, "score": 4 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 3, "score": 2 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 4, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 4, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 5, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 5, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 6, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 6, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 7, "score": 4 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 7, "score": 4 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 8, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 8, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 9, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 9, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 10, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 10, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 11, "score": 3 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 11, "score": 3 },
    { "playerId": "68da392e41254148ddea8883", "holeNumber": 12, "score": 4 },
    { "playerId": "68de2fc34881f99410003b91", "holeNumber": 12, "score": 3 }
  ],
  "status": "completed",
  "createdAt": new Date("2026-01-20T14:00:28.379Z"),
  "updatedAt": new Date("2026-01-20T14:00:28.379Z")
};

async function testBadgeObjectIdStringFix() {
  let db;
  
  try {
    console.log('🚀 Starting test for ObjectId/String comparison fix...\n');
    
    // Initialize database
    console.log('📦 Initializing database connection...');
    db = await initializeDatabase();
    console.log('✅ Database connected\n');
    
    const scorecardsCollection = db.collection('scorecards');
    const badgeDefinitionsCollection = db.collection('badgeDefinitions');
    const friendsCollection = db.collection('friends');
    
    // Test player ID
    const playerId = "68da392e41254148ddea8883";
    const playerIdObj = new ObjectId(playerId);
    const courseId = testScorecard.courseId;
    
    console.log('📋 Test Configuration:');
    console.log(`   Player ID: ${playerId}`);
    console.log(`   Course ID: ${courseId}`);
    console.log(`   Scorecard ID: ${testScorecard._id}`);
    console.log(`   Players in scorecard: ${[...new Set(testScorecard.results.map(r => r.playerId))].join(', ')}\n`);
    
    // Fetch badge definition
    console.log('🔍 Fetching badge definitions...');
    const badgeDefinitions = await badgeDefinitionsCollection.find({
      requiresHistoricalData: true
    }).toArray();
    
    console.log(`   Found ${badgeDefinitions.length} historical badge(s)`);
    badgeDefinitions.forEach(b => {
      console.log(`     - ${b.name || b.id} (id: ${b.id})`);
    });
    
    if (badgeDefinitions.length === 0) {
      console.log('⚠️  No historical badges found.');
      console.log('   ℹ️  The test will still run but won\'t test badge checking functionality');
    }
    console.log('');
    
    // Fetch friends for the player
    console.log('👥 Fetching friends for player...');
    const friends = await friendsCollection.find({
      status: 'accepted',
      $or: [
        { from: playerIdObj },
        { to: playerId }
      ]
    }).toArray();
    
    console.log(`   Found ${friends.length} friend relationship(s)`);
    friends.forEach(f => {
      const fromStr = f.from instanceof ObjectId ? f.from.toString() : f.from;
      const toStr = f.to instanceof ObjectId ? f.to.toString() : f.to;
      console.log(`     - from: ${fromStr} (type: ${f.from instanceof ObjectId ? 'ObjectId' : typeof f.from})`);
      console.log(`       to: ${toStr} (type: ${f.to instanceof ObjectId ? 'ObjectId' : typeof f.to})`);
      console.log(`       status: ${f.status}`);
    });
    console.log('');
    
    // Check if test scorecard exists (read-only)
    console.log('📝 Checking if test scorecard exists...');
    const existingScorecard = await scorecardsCollection.findOne({ _id: testScorecard._id });
    if (!existingScorecard) {
      console.log('   ⚠️  Test scorecard NOT found in database');
      console.log('   ℹ️  The test will use the provided scorecard data for reference only');
      console.log('   ℹ️  Aggregation will only process existing scorecards in the database');
    } else {
      console.log('   ✅ Test scorecard found in database');
      console.log(`   ℹ️  Using existing scorecard: ${existingScorecard._id}`);
    }
    console.log('');
    
    // Calculate expected scores
    const player1Results = testScorecard.results.filter(r => r.playerId === playerId);
    const player2Results = testScorecard.results.filter(r => r.playerId === "68de2fc34881f99410003b91");
    const player1Total = player1Results.reduce((sum, r) => sum + r.score, 0);
    const player2Total = player2Results.reduce((sum, r) => sum + r.score, 0);
    
    console.log('📊 Scorecard Analysis:');
    console.log(`   Player 1 (${playerId}): ${player1Total} strokes`);
    console.log(`   Player 2 (68de2fc34881f99410003b91): ${player2Total} strokes`);
    console.log(`   Player 1 ${player1Total > player2Total ? 'LOST' : 'WON'} (higher score = worse in disc golf)`);
    console.log('');
    
    // Test the aggregation pipeline directly
    console.log('🧪 Testing aggregation pipeline...');
    const scorecardsCollectionTest = db.collection('scorecards');
    const playerIdStr = String(playerId);
    const playerIdObjTest = ObjectId.isValid(playerIdStr) ? new ObjectId(playerIdStr) : playerIdStr;
    
    // Build a test aggregation pipeline similar to what checkHistoricalBadges uses
    const testPipeline = [
      {
        $match: {
          status: 'completed',
          _id: { $ne: testScorecard._id },
          $or: [
            { creatorId: playerIdObjTest },
            { 'results.playerId': playerIdStr }
          ]
        }
      },
      // Lookup friends
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
      {
        $addFields: {
          friendIds: '$friends.friendId'
        }
      },
      // Test facet pipeline for losses against friends
      {
        $facet: {
          testLosses: [
            { $unwind: '$results' },
            {
              $group: {
                _id: {
                  scorecardId: '$_id',
                  playerId: '$results.playerId'
                },
                totalScore: { $sum: '$results.score' },
                scorecardId: { $first: '$_id' },
                friendIds: { $first: '$friendIds' }
              }
            },
            {
              $group: {
                _id: '$scorecardId',
                playerScores: {
                  $push: {
                    playerId: { $toString: '$_id.playerId' }, // Convert to string
                    totalScore: '$totalScore'
                  }
                },
                friendIds: { $first: '$friendIds' }
              }
            },
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: {
                        $ifNull: [
                          {
                            $setIntersection: ['$playerScores.playerId', '$friendIds']
                          },
                          []
                        ]
                      }
                    },
                    0
                  ]
                }
              }
            },
            {
              $addFields: {
                playerScore: {
                  $let: {
                    vars: {
                      player: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$playerScores',
                              as: 'ps',
                              cond: { $eq: ['$$ps.playerId', playerIdStr] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: '$$player.totalScore'
                  }
                },
                friendScores: {
                  $filter: {
                    input: '$playerScores',
                    as: 'ps',
                    cond: {
                      $and: [
                        { $ne: ['$$ps.playerId', playerIdStr] },
                        { $in: ['$$ps.playerId', '$friendIds'] }
                      ]
                    }
                  }
                }
              }
            },
            {
              $addFields: {
                lost: {
                  $cond: {
                    if: {
                      $gt: [
                        { $size: { $ifNull: ['$friendScores', []] } },
                        0
                      ]
                    },
                    then: {
                      $gt: [
                        '$playerScore',
                        { $min: '$friendScores.totalScore' }
                      ]
                    },
                    else: false
                  }
                }
              }
            },
            {
              $match: { lost: true }
            },
            {
              $group: {
                _id: null,
                value: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];
    
    const aggResult = await scorecardsCollectionTest.aggregate(testPipeline).toArray();
    const resultDoc = aggResult[0] || {};
    
    console.log('📊 Aggregation Result:');
    console.log(JSON.stringify(resultDoc, null, 2));
    console.log('');
    
    if (resultDoc.testLosses && resultDoc.testLosses.length > 0) {
      const lossesCount = resultDoc.testLosses[0].value || 0;
      console.log(`✅ SUCCESS: Found ${lossesCount} loss(es) against friends`);
      console.log('   The ObjectId/String comparison is working correctly!');
    } else {
      console.log('⚠️  No losses found. This could mean:');
      console.log('   1. The player has no friends in the database');
      console.log('   2. The player hasn\'t lost to friends in any scorecards');
      console.log('   3. There\'s still an ObjectId/String comparison issue');
    }
    
    // Now test with checkHistoricalBadges if we have badges (read-only)
    if (badgeDefinitions.length > 0) {
      console.log('\n🔍 Testing checkHistoricalBadges function (read-only)...');
      const historicalBadges = badgeDefinitions.filter(b => b.requiresHistoricalData);
      const badgeResults = await checkHistoricalBadges(db, playerId, historicalBadges, courseId);
      
      console.log('\n📊 Badge Check Results:');
      console.log(JSON.stringify(badgeResults, null, 2));
      console.log('   ℹ️  Note: checkHistoricalBadges only reads from database, no writes performed');
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.error(error.stack);
  } finally {
    if (db) {
      await closeDatabase();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the test
testBadgeObjectIdStringFix().catch(console.error);
