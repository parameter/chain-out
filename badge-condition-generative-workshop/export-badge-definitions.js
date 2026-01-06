const fs = require('fs');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeDatabase, getDatabase } = require('../config/database');

async function exportBadgeDefinitions() {
  try {
    console.log('Initializing database connection...');
    await initializeDatabase();
    const db = getDatabase();

    console.log('Fetching badgeDefinitions from database...');
    const badgeDefinitionsCollection = db.collection('badgeDefinitions');
    const badges = await badgeDefinitionsCollection.find({}).toArray();

    console.log(`Fetched ${badges.length} badge definition documents.`);

    const outputPath = path.join(__dirname, 'badgeDefinitions.json');
    fs.writeFileSync(outputPath, JSON.stringify(badges, null, 2), 'utf8');

    console.log(`Saved badge definitions to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Error exporting badge definitions:', error);
    process.exit(1);
  }
}

exportBadgeDefinitions();


