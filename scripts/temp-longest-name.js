/**
 * Temporary one-off: find document(s) with the longest `name` string in a collection.
 *
 * Requires MONGODB_URI in .env (same as the app).
 *
 * Usage:
 *   node scripts/temp-longest-name.js
 *   node scripts/temp-longest-name.js badgeDefinitions
 *   node scripts/temp-longest-name.js courses --ties
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const DEFAULT_COLLECTION = 'badgeDefinitions';

function parseArgs(argv) {
  const args = argv.slice(2);
  const ties = args.includes('--ties');
  const collection = args.find((a) => !a.startsWith('-')) || DEFAULT_COLLECTION;
  return { collection, ties };
}

async function findLongestName(db, collectionName) {
  const pipeline = [
    { $match: { name: { $type: 'string' } } },
    { $addFields: { nameLength: { $strLenCP: '$name' } } },
    { $sort: { nameLength: -1 } },
    { $limit: 1 },
  ];

  const [doc] = await db.collection(collectionName).aggregate(pipeline).toArray();
  return doc;
}

async function findAllTiedLongest(db, collectionName) {
  const pipeline = [
    { $match: { name: { $type: 'string' } } },
    { $addFields: { nameLength: { $strLenCP: '$name' } } },
    { $sort: { nameLength: -1 } },
    {
      $group: {
        _id: null,
        maxLen: { $first: '$nameLength' },
        docs: { $push: '$$ROOT' },
      },
    },
    { $unwind: '$docs' },
    { $match: { $expr: { $eq: ['$docs.nameLength', '$maxLen'] } } },
    { $replaceRoot: { newRoot: '$docs' } },
    { $sort: { _id: 1 } },
  ];

  return db.collection(collectionName).aggregate(pipeline).toArray();
}

function printDoc(doc, index) {
  const prefix = index != null ? `[${index + 1}] ` : '';
  console.log(`${prefix}_id: ${doc._id}`);
  console.log(`    name (${doc.nameLength} chars): ${doc.name}`);
}

async function main() {
  const mongoUrl = process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI in environment (.env).');
    process.exit(1);
  }

  const { collection, ties } = parseArgs(process.argv);
  const client = new MongoClient(mongoUrl);

  await client.connect();
  try {
    const db = client.db('chain-out-db');
    const totalWithName = await db.collection(collection).countDocuments({
      name: { $type: 'string' },
    });

    console.log(`Database: ${db.databaseName}`);
    console.log(`Collection: ${collection}`);
    console.log(`Documents with string name: ${totalWithName}`);

    if (totalWithName === 0) {
      console.log('No documents with a string `name` field.');
      return;
    }

    if (ties) {
      const docs = await findAllTiedLongest(db, collection);
      console.log(`\nLongest name length: ${docs[0].nameLength} (${docs.length} tied)`);
      docs.forEach((doc, i) => {
        console.log('');
        printDoc(doc, i);
      });
    } else {
      const doc = await findLongestName(db, collection);
      console.log(`\nLongest name length: ${doc.nameLength}`);
      console.log('');
      printDoc(doc);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
