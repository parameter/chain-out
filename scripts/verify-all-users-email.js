/**
 * Set emailVerified: true for every document in the users collection.
 * Run from project root: node scripts/verify-all-users-email.js
 * Requires MONGODB_URI in env (e.g. .env or export).
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI in environment');
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl);
  try {
    await client.connect();
    const db = client.db('chain-out-db');
    const users = db.collection('users');

    const total = await users.countDocuments({});
    const result = await users.updateMany(
      {},
      { $set: { emailVerified: true, updated_at: new Date() } }
    );

    console.log(`Users in collection: ${total}`);
    console.log(`Matched: ${result.matchedCount}, modified: ${result.modifiedCount}`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
