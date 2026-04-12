/**
 * Temporary one-off: dump all documents from the `courses` collection to a single JSON file.
 *
 * Requires MONGODB_URI in .env (same as the app).
 *
 * Usage:
 *   node scripts/temp-dump-all-courses.js
 *   node scripts/temp-dump-all-courses.js path/to/out.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const DEFAULT_OUT = path.join(__dirname, '..', 'all-courses-dump.json');

async function main() {
  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI in environment (.env).');
    process.exit(1);
  }

  const outPath = path.resolve(process.argv[2] || DEFAULT_OUT);
  const client = new MongoClient(mongoUrl);

  await client.connect();
  try {
    const db = client.db('chain-out-db');
    const courses = await db.collection('courses').find({}).toArray();

    const payload = {
      exportedAt: new Date().toISOString(),
      database: db.databaseName,
      collection: 'courses',
      count: courses.length,
      courses,
    };

    fs.writeFileSync(outPath, EJSON.stringify(payload, { relaxed: true }, 2), 'utf8');
    console.log(`Wrote ${courses.length} course(s) to ${outPath}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
