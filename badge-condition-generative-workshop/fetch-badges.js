const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { initializeDatabase, getDatabase } = require('../config/database');

async function fetchAndAnalyzeBadges() {
  try {
    let badges = [];
    
    // Try to fetch from API first if server is running
    try {
      const http = require('http');
      const url = require('url');
      const apiUrl = process.env.API_URL || 'http://localhost:5000';
      
      console.log(`Attempting to fetch badges from API: ${apiUrl}/admin/api/badges`);
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`${apiUrl}/admin/api/badges`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`API returned status ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('API request timeout'));
        });
      });
      badges = response;
      console.log('Successfully fetched badges from API\n');
    } catch (apiError) {
      console.log('API not available, trying database connection...\n');
      
      // Check if MONGODB_URI is set
      if (!process.env.MONGODB_URI) {
        console.error('Error: MONGODB_URI environment variable is not set.');
        console.error('Please set it in your .env file or environment variables.');
        console.error('Alternatively, start your server and it will fetch from API automatically.');
        process.exit(1);
      }
      
      // Initialize database connection
      await initializeDatabase();
      const db = getDatabase();
      
      // Fetch all badges from badgeDefinitions collection
      const badgeDefinitionsCollection = db.collection('badgeDefinitions');
      badges = await badgeDefinitionsCollection.find({}).toArray();
    }
    
    console.log(`\nTotal badges found: ${badges.length}\n`);
    
    // Find badges with done: true - check multiple possible locations
    const doneBadges = badges.filter(badge => {
      // Check if badge itself has done: true
      if (badge.done === true) return true;
      
      // Check if condition object has done: true
      if (badge.condition && typeof badge.condition === 'object' && badge.condition.done === true) {
        return true;
      }
      
      // Check if condition string contains done: true (might be JSON stringified)
      if (typeof badge.condition === 'string') {
        try {
          const parsed = JSON.parse(badge.condition);
          if (parsed && parsed.done === true) return true;
        } catch (e) {
          // Not JSON, check if string contains "done: true" or "done:true"
          if (badge.condition.includes('done: true') || badge.condition.includes('done:true') || badge.condition.includes('"done":true')) {
            return true;
          }
        }
      }
      
      return false;
    });
    
    console.log(`Badges with done: true: ${doneBadges.length}\n`);
    
    // Display badges with done: true
    console.log('=== BADGES WITH done: true ===\n');
    doneBadges.forEach((badge, index) => {
      console.log(`${index + 1}. ${badge.name}`);
      console.log(`   ID: ${badge.id}`);
      console.log(`   Functional Description: ${badge.functionalDescription || 'N/A'}`);
      console.log(`   Condition (first 500 chars): ${typeof badge.condition === 'string' ? badge.condition.substring(0, 500) : JSON.stringify(badge.condition).substring(0, 500)}...`);
      console.log('');
    });
    
    // Find "Skilled Recovery" badge
    const skilledRecoveryBadge = badges.find(b => 
      b.name && b.name.toLowerCase().includes('skilled recovery')
    );
    
    console.log('\n=== SKILLED RECOVERY BADGE ===\n');
    if (skilledRecoveryBadge) {
      console.log(`Name: ${skilledRecoveryBadge.name}`);
      console.log(`ID: ${skilledRecoveryBadge.id}`);
      console.log(`Functional Description: ${skilledRecoveryBadge.functionalDescription || 'N/A'}`);
      console.log(`Has Condition: ${!!skilledRecoveryBadge.condition}`);
      if (skilledRecoveryBadge.condition) {
        console.log(`Condition Type: ${typeof skilledRecoveryBadge.condition}`);
        if (typeof skilledRecoveryBadge.condition === 'string') {
          console.log(`Condition Length: ${skilledRecoveryBadge.condition.length}`);
          console.log(`Condition Preview: ${skilledRecoveryBadge.condition.substring(0, 300)}...`);
        }
      }
      console.log(`Done Status: ${skilledRecoveryBadge.condition?.done || (typeof skilledRecoveryBadge.condition === 'string' ? 'N/A (string)' : 'N/A')}`);
    } else {
      console.log('Skilled Recovery badge not found');
    }
    
    // Show a few example conditions from done badges to understand the pattern
    if (doneBadges.length > 0) {
      console.log('\n=== EXAMPLE CONDITIONS (from done badges) ===\n');
      doneBadges.slice(0, 3).forEach((badge, index) => {
        console.log(`\nExample ${index + 1}: ${badge.name}`);
        console.log('Full condition:');
        if (typeof badge.condition === 'string') {
          console.log(badge.condition);
        } else {
          console.log(JSON.stringify(badge.condition, null, 2));
        }
        console.log('\n---\n');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchAndAnalyzeBadges();

