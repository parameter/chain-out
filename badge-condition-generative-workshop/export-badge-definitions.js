const fs = require('fs');
const path = require('path');

// Load environment variables from project root .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeDatabase, getDatabase, closeDatabase } = require('../config/database');

async function exportBadgeDefinitions() {
  try {
    console.log('🧩 Exporting badgeDefinitions from MongoDB...\n');

    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set. Please add it to your .env file.');
      console.error('   Example: MONGODB_URI=mongodb://localhost:27017/chain-out-db');
      process.exit(1);
    }

    console.log('📦 Initializing database connection...');
    await initializeDatabase();
    const db = getDatabase();

    const collection = db.collection('badgeDefinitions');

    console.log('🔍 Fetching all badgeDefinitions...');
    const allBadges = await collection.find({}).toArray();
    console.log(`   Found ${allBadges.length} badge definition(s).\n`);

    const outputDir = __dirname;
    const allPath = path.join(outputDir, 'badgeDefinitions-from-db.json');
    const donePath = path.join(outputDir, 'badgeDefinitions-done.json');

    fs.writeFileSync(allPath, JSON.stringify(allBadges, null, 2), 'utf8');
    console.log(`💾 Wrote ALL badgeDefinitions to: ${allPath}`);

    const doneBadges = allBadges.filter((b) => b.done === true);
    fs.writeFileSync(donePath, JSON.stringify(doneBadges, null, 2), 'utf8');
    console.log(`💾 Wrote done===true badgeDefinitions to: ${donePath}`);
    console.log(`   Count of done===true badges: ${doneBadges.length}\n`);

    console.log('📋 Badges with done === true:');
    doneBadges.forEach((b) => {
      const id = b.id || String(b._id);
      const name = b.name || '';
      console.log(` - ${id}  ${name}`);
    });
  } catch (error) {
    console.error('\n❌ Failed to export badgeDefinitions:', error);
  } finally {
    try {
      await closeDatabase();
    } catch (e) {
      // ignore close errors
    }
    console.log('\n🔌 Database connection closed (if it was open).');
  }
}

if (require.main === module) {
  exportBadgeDefinitions()
    .then(() => {
      console.log('\n✅ Export script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Export script crashed:', err);
      process.exit(1);
    });
}

module.exports = { exportBadgeDefinitions };

