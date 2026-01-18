/**
 * HTTP test script for /stats/general route
 * Tests with user ID: 68da392e41254148ddea8883
 * 
 * Usage: 
 *   1. Start the server: npm run dev
 *   2. Run this test: node test-stats-route-http.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

const TEST_USER_ID = '68da392e41254148ddea8883';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';
const API_URL = process.env.API_URL || 'http://localhost:5000';
const API_PATH = '/api/users/stats/general';

// Generate JWT token for the test user
function generateTestToken(userId) {
  return jwt.sign(
    { sub: userId, userType: 'user' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Make HTTP request to the stats endpoint
function makeStatsRequest(token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_PATH, API_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: jsonData });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(jsonData)}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}\nResponse: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

async function testStatsRouteHTTP() {
  try {
    console.log('🧪 Testing /stats/general route via HTTP');
    console.log(`📋 User ID: ${TEST_USER_ID}`);
    console.log(`🌐 API URL: ${API_URL}${API_PATH}\n`);

    // Generate JWT token
    console.log('🔑 Generating JWT token...');
    const token = generateTestToken(TEST_USER_ID);
    console.log(`✅ Token generated: ${token.substring(0, 50)}...\n`);

    // Make request
    console.log('📡 Making HTTP request...');
    const startTime = Date.now();
    const response = await makeStatsRequest(token);
    const duration = Date.now() - startTime;

    console.log(`✅ Request completed in ${duration}ms`);
    console.log(`📊 Status Code: ${response.statusCode}\n`);

    // Display results
    console.log('📈 Stats Results:');
    console.log('─'.repeat(50));
    console.log(`   Rounds Count: ${response.data.roundsCount}`);
    console.log(`   Unique Courses: ${response.data.uniqueCoursesCount}`);
    console.log(`   Total Badges: ${response.data.totalBadgesCount}`);
    console.log(`   Verified Percentage: ${response.data.verifiedPercentage}%`);
    console.log(`   Weekly Streak: ${response.data.weeklyStreak} weeks`);
    console.log(`   Achievements: ${response.data.achievementsCount}`);
    console.log('\n   Badge Counts by Tier:');
    console.log(`     Bronze: ${response.data.bronzeBadgesCount}`);
    console.log(`     Silver: ${response.data.silverBadgesCount}`);
    console.log(`     Gold: ${response.data.goldBadgesCount}`);
    console.log(`     Platinum: ${response.data.platinumBadgesCount}`);
    console.log(`     Diamond: ${response.data.diamondBadgesCount}`);
    console.log(`     Emerald: ${response.data.emeraldBadgesCount}`);
    console.log(`     Ruby: ${response.data.rubyBadgesCount}`);
    console.log(`     Cosmic: ${response.data.cosmicBadgesCount}`);
    console.log('─'.repeat(50));

    console.log('\n✨ Full Response:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n✅ HTTP test completed successfully!');
    return response.data;

  } catch (error) {
    console.error('❌ HTTP test failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure the server is running (npm run dev)');
    }
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testStatsRouteHTTP()
    .then(() => {
      console.log('\n🎉 All HTTP tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 HTTP test failed:', error);
      process.exit(1);
    });
}

module.exports = { testStatsRouteHTTP };

