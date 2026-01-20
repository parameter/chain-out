/**
 * Test script for "losses against friends" historical badge
 * 
 * Tests the aggregate pipeline that counts how many times a player lost
 * against friends on the same scorecard.
 * 
 * Usage: node test-losses-against-friends-badge.js
 */

require('dotenv').config();
const { ObjectId } = require('mongodb');
const { initializeDatabase, getDatabase } = require('./config/database');
const { checkHistoricalBadges } = require('./lib/badges');

const TEST_PLAYER_ID = '68da392e41254148ddea8883';
const TEST_FRIEND_ID = '68da392e41254148ddea8884';
const TEST_COURSE_ID = '68da392e41254148ddea8885';

async function testLossesAgainstFriendsBadge() {
  try {
    console.log('🧪 Testing "losses against friends" historical badge');
    console.log(`📋 Player ID: ${TEST_PLAYER_ID}`);
    console.log(`👥 Friend ID: ${TEST_FRIEND_ID}\n`);

    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await initializeDatabase();
    const db = getDatabase();
    console.log('✅ Database connected\n');

    const scorecardsCollection = db.collection('scorecards');
    const friendsCollection = db.collection('friends');
    const badgeDefinitionsCollection = db.collection('badgeDefinitions');

    const playerId = new ObjectId(TEST_PLAYER_ID);
    const friendId = new ObjectId(TEST_FRIEND_ID);
    const courseId = new ObjectId(TEST_COURSE_ID);
    const playerIdStr = playerId.toString();
    const friendIdStr = friendId.toString();

    // Clean up test data - remove all scorecards for this player and course
    console.log('🧹 Cleaning up test data...');
    await scorecardsCollection.deleteMany({
      $or: [
        { _id: { $in: [
          new ObjectId('68da392e41254148ddea9001'),
          new ObjectId('68da392e41254148ddea9002'),
          new ObjectId('68da392e41254148ddea9003')
        ]}},
        {
          creatorId: playerId,
          courseId: courseId,
          status: 'completed'
        }
      ]
    });
    await friendsCollection.deleteMany({
      $or: [
        { from: playerId, to: friendId },
        { from: friendId, to: playerId }
      ]
    });
    console.log('✅ Cleanup complete\n');

    // Setup: Create friendship
    console.log('👥 Creating friendship...');
    await friendsCollection.insertOne({
      from: playerId,
      to: friendId,
      status: 'accepted',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Friendship created\n');

    // Setup: Create test scorecards
    console.log('📝 Creating test scorecards...');
    
    // Scorecard 1: Player lost (score 60 vs friend's 55)
    const scorecard1 = {
      _id: new ObjectId('68da392e41254148ddea9001'),
      creatorId: playerId,
      courseId: courseId,
      status: 'completed',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      results: [
        // Player's results (total: 60)
        { playerId: playerIdStr, holeNumber: 1, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 2, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 3, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 4, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 5, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 6, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 7, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 8, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 9, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 10, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 11, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 12, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 13, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 14, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 15, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 16, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 17, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 18, score: 4, timestamp: new Date() },
        // Friend's results (total: 55 - friend wins)
        { playerId: friendIdStr, holeNumber: 1, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 2, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 3, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 4, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 5, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 6, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 7, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 8, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 9, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 10, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 11, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 12, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 13, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 14, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 15, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 16, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 17, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 18, score: 3, timestamp: new Date() }
      ]
    };

    // Scorecard 2: Player won (score 54 vs friend's 56)
    const scorecard2 = {
      _id: new ObjectId('68da392e41254148ddea9002'),
      creatorId: playerId,
      courseId: courseId,
      status: 'completed',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      results: [
        // Player's results (total: 54 - player wins)
        { playerId: playerIdStr, holeNumber: 1, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 2, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 3, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 4, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 5, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 6, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 7, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 8, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 9, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 10, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 11, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 12, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 13, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 14, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 15, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 16, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 17, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 18, score: 3, timestamp: new Date() },
        // Friend's results (total: 56)
        { playerId: friendIdStr, holeNumber: 1, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 2, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 3, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 4, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 5, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 6, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 7, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 8, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 9, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 10, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 11, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 12, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 13, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 14, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 15, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 16, score: 4, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 17, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 18, score: 4, timestamp: new Date() }
      ]
    };

    // Scorecard 3: Player lost again (score 58 vs friend's 56)
    const scorecard3 = {
      _id: new ObjectId('68da392e41254148ddea9003'),
      creatorId: playerId,
      courseId: courseId,
      status: 'completed',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
      results: [
        // Player's results (total: 58)
        { playerId: playerIdStr, holeNumber: 1, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 2, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 3, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 4, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 5, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 6, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 7, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 8, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 9, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 10, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 11, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 12, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 13, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 14, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 15, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 16, score: 3, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 17, score: 4, timestamp: new Date() },
        { playerId: playerIdStr, holeNumber: 18, score: 3, timestamp: new Date() },
        // Friend's results (total: 56 - friend wins)
        { playerId: friendIdStr, holeNumber: 1, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 2, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 3, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 4, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 5, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 6, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 7, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 8, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 9, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 10, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 11, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 12, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 13, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 14, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 15, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 16, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 17, score: 3, timestamp: new Date() },
        { playerId: friendIdStr, holeNumber: 18, score: 3, timestamp: new Date() }
      ]
    };

    await scorecardsCollection.insertMany([scorecard1, scorecard2, scorecard3]);
    console.log('✅ Test scorecards created\n');

    // Create badge definition
    console.log('🏆 Creating badge definition...');
    const badgeCondition = `
      // Build pipeline to count losses against friends
      // Note: friendIds is already available on each scorecard document (from the shared lookup)
      const facetPipeline = [
        // Unwind results to work with individual result entries
        { $unwind: '$results' },
        // Group by scorecard and player to calculate total scores
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
        // Group by scorecard to get all player scores together
        {
          $group: {
            _id: '$scorecardId',
            playerScores: {
              $push: {
                playerId: '$_id.playerId',
                totalScore: '$totalScore'
              }
            },
            friendIds: { $first: '$friendIds' }
          }
        },
        // Filter to only scorecards where at least one friend played
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
        // Calculate if player lost to any friend
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
        // Check if player lost (higher score = worse in disc golf)
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
                  $let: {
                    vars: {
                      friendScoreArray: {
                        $map: {
                          input: '$friendScores',
                          as: 'fs',
                          in: '$$fs.totalScore'
                        }
                      }
                    },
                    in: {
                      $gt: [
                        '$playerScore',
                        { $min: '$$friendScoreArray' }
                      ]
                    }
                  }
                },
                else: false
              }
            }
          }
        },
        // Count scorecards where player lost
        {
          $match: { lost: true }
        },
        {
          $group: {
            _id: null,
            value: { $sum: 1 }
          }
        }
      ];
      
      return {
        facetPipeline,
        valueField: 'value',
        asProgress: true
      };
    `;

    await badgeDefinitionsCollection.updateOne(
      { id: 'friendly_fire' },
      {
        $set: {
          id: 'friendly_fire',
          name: 'Friendly Fire',
          requiresHistoricalData: true,
          isUnique: false,
          type: 'tiered',
          tierThresholds: [1, 5, 10],
          condition: badgeCondition
        }
      },
      { upsert: true }
    );
    console.log('✅ Badge definition created\n');

    // Test the badge
    console.log('🧪 Testing badge calculation...');
    const badgeDef = await badgeDefinitionsCollection.findOne({ id: 'friendly_fire' });
    const historicalBadges = [badgeDef];
    
    // Debug: Check what scorecards exist
    const allScorecards = await scorecardsCollection.find({
      _id: { $in: [
        new ObjectId('68da392e41254148ddea9001'),
        new ObjectId('68da392e41254148ddea9002'),
        new ObjectId('68da392e41254148ddea9003')
      ]}
    }).toArray();
    
    console.log(`\n📋 Found ${allScorecards.length} test scorecards`);
    for (const sc of allScorecards) {
      const playerResults = sc.results.filter(r => r.playerId === playerIdStr);
      const friendResults = sc.results.filter(r => r.playerId === friendIdStr);
      const playerTotal = playerResults.reduce((sum, r) => sum + r.score, 0);
      const friendTotal = friendResults.reduce((sum, r) => sum + r.score, 0);
      console.log(`  Scorecard ${sc._id}: Player ${playerTotal} vs Friend ${friendTotal} (${playerTotal > friendTotal ? 'LOST' : 'WON'})`);
    }
    
    // Debug: Run a simplified version of the pipeline to see what's happening
    console.log('\n🔍 Debugging aggregate pipeline...');
    const debugPipeline = [
      {
        $match: {
          status: 'completed',
          $or: [
            { creatorId: playerId },
            { 'results.playerId': playerIdStr }
          ]
        }
      },
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
              playerId: '$_id.playerId',
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
                $let: {
                  vars: {
                    friendScoreArray: {
                      $map: {
                        input: '$friendScores',
                        as: 'fs',
                        in: '$$fs.totalScore'
                      }
                    }
                  },
                  in: {
                    $gt: [
                      '$playerScore',
                      { $min: '$$friendScoreArray' }
                    ]
                  }
                }
              },
              else: false
            }
          }
        }
      },
      {
        $project: {
          scorecardId: '$_id',
          playerScore: 1,
          friendScores: 1,
          lost: 1,
          friendIds: 1
        }
      }
    ];
    
    const debugResults = await scorecardsCollection.aggregate(debugPipeline).toArray();
    console.log('\n🔍 Debug results:');
    for (const result of debugResults) {
      console.log(`  Scorecard ${result.scorecardId}:`);
      console.log(`    Player Score: ${result.playerScore}`);
      console.log(`    Friend Scores: ${JSON.stringify(result.friendScores)}`);
      console.log(`    Lost: ${result.lost}`);
    }
    
    const results = await checkHistoricalBadges(db, playerId, historicalBadges, courseId);
    
    console.log('\n📊 Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Verify results
    const badgeResult = results.find(r => r.badgeId === 'friendly_fire');
    if (!badgeResult) {
      throw new Error('❌ Badge result not found');
    }
    
    // Note: The result might include other scorecards from the database
    // We expect at least 2 losses (from our test scorecards 1 and 3)
    if (badgeResult.progress < 2) {
      throw new Error(`❌ Expected at least 2 losses, got ${badgeResult.progress}`);
    }
    
    console.log(`\n✅ Test passed! Player lost ${badgeResult.progress} times against friend`);
    console.log('   (Includes test scorecards 1 and 3, plus any existing scorecards in database)');
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await scorecardsCollection.deleteMany({
      _id: { $in: [
        new ObjectId('68da392e41254148ddea9001'),
        new ObjectId('68da392e41254148ddea9002'),
        new ObjectId('68da392e41254148ddea9003')
      ]}
    });
    await friendsCollection.deleteMany({
      $or: [
        { from: playerId, to: friendId },
        { from: friendId, to: playerId }
      ]
    });
    await badgeDefinitionsCollection.deleteOne({ id: 'friendly_fire' });
    console.log('✅ Cleanup complete\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testLossesAgainstFriendsBadge();

