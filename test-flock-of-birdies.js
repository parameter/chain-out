/**
 * Test script for flock_of_birdies badge
 * 
 * This script tests the badge system with a specific scorecard that has 5 birdies.
 * Expected behavior:
 * - For trackTierThresholdZync: false badges, totalProgress should NOT accumulate
 * - Tier should be calculated based on single round's progress
 * - With 5 birdies, tier should be 1 (thresholds: [2, 4, 6, 8, 10, 12, 15, 18])
 * 
 * Usage:
 *   Make sure MONGODB_URI is set in your .env file or environment variables
 *   Then run: npm run test:badge
 */

// Load environment variables from .env file
require('dotenv').config();

const { ObjectId } = require('mongodb');
const { initializeDatabase, closeDatabase } = require('./config/database');
const { searchForEarnedBadges } = require('./lib/badges');

// Test scorecard data (converted from MongoDB export format)
const testScorecard = {
  _id: new ObjectId("6981dd472953d1103ba2d94a"),
  creatorId: new ObjectId("697b8952ad5e2dc6dc8da5c4"),
  courseId: new ObjectId("68da917e30d97419bf9cb839"),
  layout: {
    type: "PUBLIC",
    id: "02503e27-16d3-43dd-8281-87e4035a99fd",
    name: "Röbo DiscgolfPark",
    difficulty: "INTERMEDIATE",
    payToPlay: false,
    course: {
      name: "Röbo DiscgolfPark",
      id: "9a054d90-4050-461d-b547-c1bdf1e5fa98"
    },
    latestVersion: {
      id: "f9577979-0cad-4a4c-a40d-1c0af3beaf25",
      createdAt: "2020-04-11T17:10:59.136Z",
      holes: [
        { id: "9a98cbc6-85c1-429b-9a8e-90f54c386067", number: 1, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "1328fa44-19ba-4b3b-a8eb-d2e584e3a3e0", number: 2, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "886cd32d-d19f-42bd-9604-383064ffc9d6", number: 3, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "1b6b13f2-743a-4be6-a19b-08cd0a2153b3", number: 4, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "0165cb04-8236-416d-8ec4-60e044944a12", number: 5, par: 4, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "19a46a25-b7f8-4462-a3b1-3cb1e3900751", number: 6, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "6702112a-7a87-4c85-8b44-cd658320b0c2", number: 7, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "b30dc779-0a27-4a80-92c0-875fccdf1c4a", number: 8, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null },
        { id: "6dda885f-6632-400c-b428-8dabde468758", number: 9, par: 3, name: null, length: null, measureInMeters: true, note: null, hasOb: false, hasMandatory: false, hasHazard: false, hasLocalRule: false, geolocation: null }
      ]
    }
  },
  results: [
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 1, score: 2, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:35.471Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 2, score: 2, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:37.702Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 3, score: 2, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:39.822Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 4, score: 2, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:41.901Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 5, score: 3, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:44.239Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 6, score: 3, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:46.508Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 7, score: 3, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:48.894Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 8, score: 3, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:52.557Z") },
    { playerId: new ObjectId("697b8952ad5e2dc6dc8da5c4"), holeNumber: 9, score: 3, putt: "inside", obCount: 0, specifics: { c1: false, c2: false, bullseye: false, scramble: false, throwIn: false, fairway: false }, timestamp: new Date("2026-02-03T11:34:55.099Z") }
  ],
  invites: [],
  createdAt: new Date("2026-02-03T11:34:31.937Z"),
  updatedAt: new Date("2026-02-03T11:34:31.937Z"),
  status: "completed"
};

async function testFlockOfBirdiesBadge() {
  console.log('🧪 Starting test for flock_of_birdies badge...\n');
  
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set!');
    console.error('   Please set MONGODB_URI in your .env file or environment variables.');
    console.error('   Example: MONGODB_URI=mongodb://localhost:27017/chain-out-db');
    process.exit(1);
  }
  
  try {
    // Initialize database connection
    console.log('📦 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connected\n');

    // Extract data from scorecard
    const scorecardId = testScorecard._id;
    const results = testScorecard.results;
    const courseId = testScorecard.courseId;
    const layout = testScorecard.layout;
    const scorecard = testScorecard;

    console.log('📊 Test Data:');
    console.log(`   Scorecard ID: ${scorecardId}`);
    console.log(`   Player ID: ${results[0].playerId}`);
    console.log(`   Course ID: ${courseId}`);
    console.log(`   Number of holes: ${layout.latestVersion.holes.length}`);
    console.log(`   Number of results: ${results.length}`);
    
    // Count birdies (score < par)
    const birdies = results.filter(r => {
      const hole = layout.latestVersion.holes.find(h => h.number === r.holeNumber);
      return hole && r.score < hole.par;
    }).length;
    console.log(`   Birdies in round: ${birdies}\n`);

    // Call the badge search function
    console.log('🔍 Searching for earned badges...');
    const earnedBadges = await searchForEarnedBadges({
      scorecardId,
      results,
      courseId,
      layout,
      scorecard
    });

    console.log('\n📋 Results:');
    console.log(JSON.stringify(earnedBadges, null, 2));

    // Check the badge progress in database
    const { getDatabase } = require('./config/database');
    const db = getDatabase();
    const progressCollection = db.collection('userBadgeProgress');
    
    const playerId = results[0].playerId;
    const badgeProgress = await progressCollection.findOne({
      userId: playerId,
      badgeId: 'flock_of_birdies'
    });

    console.log('\n💾 Badge Progress in Database:');
    if (badgeProgress) {
      console.log(JSON.stringify({
        badgeId: badgeProgress.badgeId,
        currentTier: badgeProgress.currentTier,
        totalProgress: badgeProgress.totalProgress,
        tierProgress: badgeProgress.tierProgress,
        trackedThresholds: badgeProgress.trackedThresholds,
        lastUpdated: badgeProgress.lastUpdated
      }, null, 2));
      
      // Verify expected values
      console.log('\n✅ Verification:');
      console.log(`   Expected birdies: ${birdies}`);
      console.log(`   Actual totalProgress: ${badgeProgress.totalProgress}`);
      console.log(`   Expected tier: ${birdies >= 4 ? 1 : birdies >= 2 ? 0 : -1}`);
      console.log(`   Actual currentTier: ${badgeProgress.currentTier}`);
      
      if (badgeProgress.totalProgress === birdies) {
        console.log('   ✓ totalProgress matches birdie count (no accumulation)');
      } else {
        console.log('   ✗ totalProgress does NOT match birdie count (may be accumulating incorrectly)');
      }
      
      const expectedTier = birdies >= 4 ? 1 : birdies >= 2 ? 0 : -1;
      if (badgeProgress.currentTier === expectedTier) {
        console.log(`   ✓ currentTier is correct (${expectedTier})`);
      } else {
        console.log(`   ✗ currentTier is incorrect. Expected: ${expectedTier}, Got: ${badgeProgress.currentTier}`);
      }
    } else {
      console.log('   No badge progress found in database');
    }

    console.log('\n✨ Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    // Close database connection
    console.log('\n🔌 Closing database connection...');
    await closeDatabase();
    console.log('✅ Database connection closed');
  }
}

// Run the test
if (require.main === module) {
  testFlockOfBirdiesBadge()
    .then(() => {
      console.log('\n🎉 Test script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test script crashed:', error);
      process.exit(1);
    });
}

module.exports = { testFlockOfBirdiesBadge };
