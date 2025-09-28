const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

let db = null;
let client = null;

const initializeDatabase = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URI
      || process.env.MONGO_URL
      || process.env.SCALINGO_MONGO_URL
      || 'mongodb://localhost:27017/tidsrapportering';
    client = new MongoClient(mongoUrl);
    
    await client.connect();
    db = client.db();
    
    console.log('Connected to MongoDB');
    
    // Create collections and indexes
    await createCollections();
    await createIndexes();
    await createDefaultUser();
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

const createCollections = async () => {
  const collections = ['users', 'time_entries'];
  
  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
      console.log(`Collection '${collectionName}' created or already exists`);
    } catch (error) {
      // Collection might already exist, which is fine
      if (error.code !== 48) { // NamespaceExists error
        console.error(`Error creating collection ${collectionName}:`, error);
      }
    }
  }
};

const createIndexes = async () => {
  try {
    // Create unique index on email
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Create index on user_id for time_entries
    await db.collection('time_entries').createIndex({ user_id: 1 });
    
    // Create compound index on user_id and date for time_entries
    await db.collection('time_entries').createIndex({ user_id: 1, date: -1 });
    
    console.log('Database indexes created');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

const createDefaultUser = async () => {
  try {
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    
    if (userCount === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await usersCollection.insertOne({
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('Default admin user created: admin@example.com / admin123');
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

const closeDatabase = async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};