// Debug script: inspect turkey_hunter progress and recent scorecards
// for a specific user.
//
// Usage:
//   node scripts/debug-turkey-hunter-user.js
//
// It will:
//   - Print the turkey_hunter badge definition (trackTierThresholdZync, etc.)
//   - Print the userBadgeProgress document for turkey_hunter
//   - Print the last few completed scorecards for this user (with basic scores)

require('dotenv').config();

const { ObjectId } = require('mongodb');
const { initializeDatabase, getDatabase, closeDatabase } = require('../config/database');

const TARGET_USER_ID = '697b8952ad5e2dc6dc8da5c4';

async function debugTurkeyHunter() {
  console.log('🧪 Debugging turkey_hunter for user:', TARGET_USER_ID);

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Please configure it in .env.');
    process.exit(1);
  }

  try {
    console.log('📦 Initializing database connection...');
    await initializeDatabase();
    const db = getDatabase();
    console.log('✅ Database connected\n');

    const badgeDefinitions = db.collection('badgeDefinitions');
    const progressCollection = db.collection('userBadgeProgress');
    const scorecards = db.collection('scorecards');

    const userIdObj = new ObjectId(TARGET_USER_ID);

    // 1) Badge definition for turkey_hunter
    const turkeyBadge = await badgeDefinitions.findOne({ id: 'turkey_hunter' });
    console.log('📋 turkey_hunter badge definition:');
    if (!turkeyBadge) {
      console.log('   ❌ No badgeDefinitions document found for id "turkey_hunter".');
    } else {
      console.log(
        JSON.stringify(
          {
            id: turkeyBadge.id,
            name: turkeyBadge.name,
            done: turkeyBadge.done,
            type: turkeyBadge.type,
            trackTierThresholdZync: turkeyBadge.trackTierThresholdZync,
            trackUniqueCourses: turkeyBadge.trackUniqueCourses,
            tierThresholds: turkeyBadge.tierThresholds,
          },
          null,
          2,
        ),
      );
    }

    // 2) Current badge progress for this user
    const badgeProgress = await progressCollection.findOne({
      userId: userIdObj,
      badgeId: 'turkey_hunter',
    });
    console.log('\n💾 userBadgeProgress for turkey_hunter:');
    if (!badgeProgress) {
      console.log('   (no document found)');
    } else {
      console.log(
        JSON.stringify(
          {
            userId: badgeProgress.userId,
            badgeId: badgeProgress.badgeId,
            totalProgress: badgeProgress.totalProgress,
            currentTier: badgeProgress.currentTier,
            trackedThresholds: badgeProgress.trackedThresholds,
            tierProgress: badgeProgress.tierProgress,
            lastUpdated: badgeProgress.lastUpdated,
          },
          null,
          2,
        ),
      );
    }

    // 3) Recent scorecards for this user
    console.log('\n📊 Last 5 completed scorecards for this user (by updatedAt):');
    const recentScorecards = await scorecards
      .find({
        'results.playerId': userIdObj,
        status: 'completed',
      })
      .project({
        _id: 1,
        courseId: 1,
        updatedAt: 1,
        createdAt: 1,
        'results.playerId': 1,
        'results.holeNumber': 1,
        'results.score': 1,
        layout: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray();

    if (!recentScorecards.length) {
      console.log('   (no completed scorecards found for this user)');
    } else {
      for (const sc of recentScorecards) {
        console.log('\n----------------------------------------');
        console.log('Scorecard ID:', sc._id);
        console.log('Course ID:   ', sc.courseId);
        console.log('Created At:  ', sc.createdAt);
        console.log('Updated At:  ', sc.updatedAt);

        const playerResults = (sc.results || []).filter(
          (r) => String(r.playerId) === TARGET_USER_ID,
        );

        const scores = playerResults
          .sort((a, b) => a.holeNumber - b.holeNumber)
          .map((r) => r.score);

        console.log('Scores for this user:', scores.join(', '));
      }
    }
  } catch (err) {
    console.error('\n❌ Debug script failed with error:');
    console.error(err);
    console.error('\nStack trace:');
    console.error(err.stack);
  } finally {
    console.log('\n🔌 Closing database connection...');
    await closeDatabase();
    console.log('✅ Database connection closed');
  }
}

if (require.main === module) {
  debugTurkeyHunter()
    .then(() => {
      console.log('\n🎉 Debug script finished');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Debug script crashed:', err);
      process.exit(1);
    });
}

module.exports = { debugTurkeyHunter };

