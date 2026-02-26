/**
 * Integration test for the "turkey_hunter" badge using searchForEarnedBadges.
 *
 * This script:
 *  - Uses a synthetic scorecard where a player makes 6 birdies in a row.
 *  - Calls searchForEarnedBadges so the normal badge pipeline runs.
 *  - Reads back userBadgeProgress for badgeId "turkey_hunter".
 *
 * Before running:
 *  - Ensure MONGODB_URI is set in your .env file.
 *  - Ensure there is a badgeDefinitions document with id "turkey_hunter",
 *    done === true, and a condition that matches the intended turkey logic.
 *
 * Run with:
 *   node test-turkey-hunter.js
 * or via an npm script similar to test-flock-of-birdies.
 */

require('dotenv').config();

const { ObjectId } = require('mongodb');
const { initializeDatabase, getDatabase, closeDatabase } = require('./config/database');
const { searchForEarnedBadges } = require('./lib/badges');

async function testTurkeyHunterBadge() {
  console.log('🧪 Starting test for turkey_hunter badge...\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set!');
    console.error('   Please set MONGODB_URI in your .env file or environment variables.');
    console.error('   Example: MONGODB_URI=mongodb://localhost:27017/chain-out-db');
    process.exit(1);
  }

  try {
    console.log('📦 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connected\n');

    const db = getDatabase();
    const badgeDefinitionsCollection = db.collection('badgeDefinitions');

    // Check that turkey_hunter exists and is enabled (done === true)
    const turkeyBadge = await badgeDefinitionsCollection.findOne({ id: 'turkey_hunter' });
    if (!turkeyBadge) {
      console.error('❌ No badgeDefinitions entry found for id "turkey_hunter".');
      console.error('   Add this badge to the badgeDefinitions collection before running the test.');
      return;
    }

    console.log('📋 turkey_hunter badge definition (from DB):');
    console.log(`   id:       ${turkeyBadge.id}`);
    console.log(`   name:     ${turkeyBadge.name}`);
    console.log(`   done:     ${turkeyBadge.done}`);
    console.log(`   type:     ${turkeyBadge.type}`);
    console.log('');

    if (!turkeyBadge.done) {
      console.warn('⚠️  Warning: turkey_hunter has done !== true, so searchForEarnedBadges will NOT evaluate it.');
      console.warn('   Set done: true on this badge to include it in getBadgeDefinitions().\n');
    }

    // Synthetic test data: 9‑hole par‑3 layout, 6 birdies in a row (holes 1–6),
    // then 3 pars (holes 7–9). Expected: 2 turkeys (non‑overlapping groups of 3).
    const playerId = new ObjectId();
    const scorecardId = new ObjectId();
    const courseId = new ObjectId();

    const layout = {
      holes: Array.from({ length: 9 }).map((_, i) => ({
        number: i + 1,
        holeNumber: i + 1,
        par: 3,
      })),
    };

    const results = [
      // Holes 1–6: birdies (2 on par 3)
      { playerId, holeNumber: 1, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 2, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 3, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 4, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 5, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 6, score: 2, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      // Holes 7–9: pars (3 on par 3)
      { playerId, holeNumber: 7, score: 3, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 8, score: 3, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
      { playerId, holeNumber: 9, score: 3, putt: 'inside', obCount: 0, specifics: {}, timestamp: new Date() },
    ];

    const scorecard = {
      _id: scorecardId,
      courseId,
      layout,
      results,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      // No mode set => searchForEarnedBadges will use result.playerId as in test-flock-of-birdies
    };

    console.log('📊 Test round setup:');
    console.log(`   Player ID:        ${playerId}`);
    console.log(`   Scorecard ID:     ${scorecardId}`);
    console.log(`   Course ID:        ${courseId}`);
    console.log(`   Holes:            ${layout.holes.length}`);
    console.log(`   Birdies in a row: 6 (holes 1–6)`);
    console.log('');

    console.log('🔍 Calling searchForEarnedBadges...');
    const earnedBadges = await searchForEarnedBadges({
      scorecardId,
      results,
      courseId,
      layout,
      scorecard,
    });

    console.log('\n📋 searchForEarnedBadges returned:');
    console.log(JSON.stringify(earnedBadges, null, 2));

    // Read back badge progress for this player and turkey_hunter
    const progressCollection = db.collection('userBadgeProgress');
    const badgeProgress = await progressCollection.findOne({
      userId: playerId,
      badgeId: 'turkey_hunter',
    });

    console.log('\n💾 Badge progress in database for turkey_hunter:');
    if (!badgeProgress) {
      console.log('   No userBadgeProgress document found for this player and turkey_hunter.');
    } else {
      console.log(
        JSON.stringify(
          {
            badgeId: badgeProgress.badgeId,
            currentTier: badgeProgress.currentTier,
            totalProgress: badgeProgress.totalProgress,
            tierProgress: badgeProgress.tierProgress,
            trackedThresholds: badgeProgress.trackedThresholds,
            lastUpdated: badgeProgress.lastUpdated,
          },
          null,
          2,
        ),
      );
    }

    // Expected: 2 turkeys for 6 birdies in a row
    const expectedTurkeys = 2;
    console.log('\n✅ Verification:');
    console.log(`   Expected turkey count (this round): ${expectedTurkeys}`);
    if (!badgeProgress) {
      console.log('   ⚠️  Cannot verify turkeys; no progress document found.');
    } else {
      console.log(`   totalProgress from DB:              ${badgeProgress.totalProgress}`);
      if (badgeProgress.totalProgress === expectedTurkeys) {
        console.log('   ✓ totalProgress matches expected turkey count.');
      } else {
        console.log(
          `   ✗ totalProgress does NOT match expected turkey count. Expected ${expectedTurkeys}, got ${badgeProgress.totalProgress}`,
        );
      }
    }

    console.log('\n✨ turkey_hunter badge integration test completed.');
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    console.log('\n🔌 Closing database connection...');
    await closeDatabase();
    console.log('✅ Database connection closed');
  }
}

if (require.main === module) {
  testTurkeyHunterBadge()
    .then(() => {
      console.log('\n🎉 turkey_hunter test script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 turkey_hunter test script crashed:', error);
      process.exit(1);
    });
}

module.exports = { testTurkeyHunterBadge };

