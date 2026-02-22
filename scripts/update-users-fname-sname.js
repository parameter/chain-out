/**
 * Temporary script: set fname and sname for all users with generated placeholder names.
 * Run from project root: node scripts/update-users-fname-sname.js
 * Requires MONGODB_URI in env (e.g. .env or export).
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const PLACEHOLDER_FIRST = ['Placeholder', 'Test', 'Demo', 'Sample', 'User', 'Temp'];
const PLACEHOLDER_LAST = ['User', 'Account', 'Name', 'Profile', 'Demo', 'Test'];

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

    const cursor = users.find({});
    const all = await cursor.toArray();
    console.log(`Found ${all.length} user(s).`);

    let updated = 0;
    for (let i = 0; i < all.length; i++) {
      const u = all[i];
      const fname = `${PLACEHOLDER_FIRST[i % PLACEHOLDER_FIRST.length]}_${i + 1}`;
      const sname = `${PLACEHOLDER_LAST[i % PLACEHOLDER_LAST.length]}_${i + 1}`;

      const result = await users.updateOne(
        { _id: u._id },
        { $set: { fname, sname, updated_at: new Date() } }
      );
      if (result.modifiedCount) {
        updated++;
        console.log(`  ${u.email || u.username || u._id} -> fname: ${fname}, sname: ${sname}`);
      }
    }

    console.log(`Done. Updated ${updated} user(s).`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
