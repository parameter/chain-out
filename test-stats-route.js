/**
 * Test script for /stats/general route
 * Tests with user ID: 68da392e41254148ddea8883
 * 
 * Usage: node test-stats-route.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { initializeDatabase, getDatabase } = require('./config/database');

const TEST_USER_ID = '68da392e41254148ddea8883';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';

async function testStatsRoute() {
  try {
    console.log('🧪 Testing /stats/general route');
    console.log(`📋 User ID: ${TEST_USER_ID}\n`);

    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await initializeDatabase();
    const db = getDatabase();
    console.log('✅ Database connected\n');
    const scorecardsCollection = db.collection('scorecards');
    const badgeProgressCollection = db.collection('userBadgeProgress');
    
    const userId = new ObjectId(TEST_USER_ID);
    const userIdString = userId.toString();

    // Helper function to get ISO week number
    function getISOWeek(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function getWeekKey(date) {
      const year = date.getFullYear();
      const week = getISOWeek(date);
      return { year, week };
    }

    function getPreviousWeek(weekKey) {
      if (weekKey.week > 1) {
        return { year: weekKey.year, week: weekKey.week - 1 };
      } else {
        const lastWeekOfYear = getISOWeek(new Date(weekKey.year - 1, 11, 31));
        return { year: weekKey.year - 1, week: lastWeekOfYear };
      }
    }

    console.log('📊 Running aggregations...\n');

    // Single aggregation for all scorecard stats
    const [scorecardStats, badgeStats] = await Promise.all([
      scorecardsCollection.aggregate([
        {
          $match: {
            status: 'completed',
            $or: [
              { creatorId: userId },
              { 'results.playerId': userIdString }
            ]
          }
        },
        {
          $facet: {
            roundsCount: [
              { $group: { _id: '$_id' } },
              { $count: 'count' }
            ],
            uniqueCourses: [
              { $group: { _id: '$courseId' } },
              { $count: 'count' }
            ],
            allRounds: [
              {
                $project: {
                  createdAt: 1,
                  updatedAt: 1,
                  verified: 1
                }
              }
            ]
          }
        }
      ]).toArray(),
      
      // Single aggregation for all badge stats
      badgeProgressCollection.aggregate([
        {
          $match: {
            userId: userId
          }
        },
        {
          $lookup: {
            from: 'badgeDefinitions',
            localField: 'badgeId',
            foreignField: 'id',
            as: 'badgeDef'
          }
        },
        {
          $unwind: {
            path: '$badgeDef',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $facet: {
            totalBadges: [
              {
                $match: {
                  $or: [
                    { currentTier: { $gte: 0 } },
                    { courseId: { $exists: true } }
                  ]
                }
              },
              { $count: 'count' }
            ],
            achievements: [
              {
                $match: {
                  courseId: { $exists: true, $ne: null }
                }
              },
              { $count: 'count' }
            ],
            badgesByTier: [
              {
                $match: {
                  currentTier: { $gte: 0 },
                  'badgeDef.tier': { $exists: true }
                }
              },
              {
                $group: {
                  _id: { $toLower: '$badgeDef.tier' },
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]).toArray()
    ]);

    // Extract scorecard stats
    const scorecardData = scorecardStats[0] || {};
    const roundsCount = scorecardData.roundsCount?.[0]?.count || 0;
    const uniqueCoursesCount = scorecardData.uniqueCourses?.[0]?.count || 0;
    const allRounds = scorecardData.allRounds || [];

    console.log(`✅ Found ${roundsCount} completed rounds`);
    console.log(`✅ Found ${uniqueCoursesCount} unique courses`);

    // Calculate verified percentage
    const verifiedRounds = allRounds.filter(r => r.verified === 'verified' || r.verified === true).length;
    const verifiedPercentage = roundsCount > 0 ? Math.round((verifiedRounds / roundsCount) * 100) : 0;

    console.log(`✅ Verified rounds: ${verifiedRounds}/${roundsCount} (${verifiedPercentage}%)`);

    // Calculate weekly streak
    const roundsByWeek = new Map();
    allRounds.forEach(round => {
      const date = round.createdAt || round.updatedAt;
      if (date) {
        const d = new Date(date);
        const weekKey = getWeekKey(d);
        const key = `${weekKey.year}-W${weekKey.week}`;
        if (!roundsByWeek.has(key)) {
          roundsByWeek.set(key, weekKey);
        }
      }
    });

    let weeklyStreak = 0;
    if (roundsByWeek.size > 0) {
      const now = new Date();
      const currentWeek = getWeekKey(now);
      const sortedWeeks = Array.from(roundsByWeek.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.week - a.week;
      });
      
      if (sortedWeeks.length > 0) {
        let checkWeek = sortedWeeks[0];
        const weeksDiff = (currentWeek.year - checkWeek.year) * 52 + (currentWeek.week - checkWeek.week);
        if (weeksDiff <= 1) {
          weeklyStreak = 1;
          let prevWeek = getPreviousWeek(checkWeek);
          while (roundsByWeek.has(`${prevWeek.year}-W${prevWeek.week}`)) {
            weeklyStreak++;
            prevWeek = getPreviousWeek(prevWeek);
          }
        }
      }
    }

    console.log(`✅ Weekly streak: ${weeklyStreak} weeks`);

    // Extract badge stats
    const badgeData = badgeStats[0] || {};
    const totalBadgesCount = badgeData.totalBadges?.[0]?.count || 0;
    const achievementsCount = badgeData.achievements?.[0]?.count || 0;
    
    console.log(`✅ Total badges: ${totalBadgesCount}`);
    console.log(`✅ Achievements: ${achievementsCount}`);

    // Build tier counts from aggregation result
    const tierCounts = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
      emerald: 0,
      ruby: 0,
      cosmic: 0
    };

    (badgeData.badgesByTier || []).forEach(item => {
      const tier = item._id;
      if (tierCounts.hasOwnProperty(tier)) {
        tierCounts[tier] = item.count;
      }
    });

    console.log('\n📈 Badge counts by tier:');
    console.log(`   Bronze: ${tierCounts.bronze}`);
    console.log(`   Silver: ${tierCounts.silver}`);
    console.log(`   Gold: ${tierCounts.gold}`);
    console.log(`   Platinum: ${tierCounts.platinum}`);
    console.log(`   Diamond: ${tierCounts.diamond}`);
    console.log(`   Emerald: ${tierCounts.emerald}`);
    console.log(`   Ruby: ${tierCounts.ruby}`);
    console.log(`   Cosmic: ${tierCounts.cosmic}`);

    // Final result object (same as API response)
    const result = {
      roundsCount,
      uniqueCoursesCount,
      totalBadgesCount,
      verifiedPercentage,
      weeklyStreak,
      achievementsCount,
      bronzeBadgesCount: tierCounts.bronze,
      silverBadgesCount: tierCounts.silver,
      goldBadgesCount: tierCounts.gold,
      platinumBadgesCount: tierCounts.platinum,
      diamondBadgesCount: tierCounts.diamond,
      emeraldBadgesCount: tierCounts.emerald,
      rubyBadgesCount: tierCounts.ruby,
      cosmicBadgesCount: tierCounts.cosmic
    };

    console.log('\n✨ Test Results Summary:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n✅ Test completed successfully!');

    return result;

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    throw error;
  } finally {
    // Close database connection
    const { closeDatabase } = require('./config/database');
    await closeDatabase();
  }
}

// Run the test
if (require.main === module) {
  testStatsRoute()
    .then(() => {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testStatsRoute };

