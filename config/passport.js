const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database');
const { ObjectId } = require('mongodb');

const initializePassport = () => {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    try {
      const db = getDatabase();
      
      // Check users collection first
      const usersCollection = db.collection('users');
      let user = await usersCollection.findOne({ email: email });
      let userType = 'user';
      
      // If not found in users, check operators collection
      if (!user) {
        const operatorsCollection = db.collection('operators');
        user = await operatorsCollection.findOne({ email: email });
        userType = 'operator';
      }

      if (!user) {
        const serviceUsersCollection = db.collection('service-users');
        user = await serviceUsersCollection.findOne({ email: email });
        userType = 'service-user';
      }
      
      if (!user) {
        return done(null, false, { message: 'Invalid email or password 1' });
      }
      
      const isValidPassword = bcrypt.compareSync(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password 2' });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      // Add userType to distinguish between users and operators
      userWithoutPassword.userType = userType;
      return done(null, userWithoutPassword);
    } catch (error) {
      return done(error);
    }
  }));

  passport.serializeUser((user, done) => {
    // Store both user ID and type to know which collection to query during deserialization
    const serializedData = {
      id: user._id?.toString(),
      userType: user.userType
    };
    done(null, JSON.stringify(serializedData));
  });

  passport.deserializeUser(async (serializedData, done) => {
    try {
      const { id, userType } = JSON.parse(serializedData);
      const db = getDatabase();
      
      // Determine which collection to query based on userType
      let collectionName = '';
      if (userType === 'service-user') {
        collectionName = 'service-users';
      } else if (userType === 'operator') {
        collectionName = 'operators';
      } else {
        collectionName = 'users';
      }
      const collection = db.collection(collectionName);

      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const user = await collection.findOne(
        { _id: objectId },
        { projection: { password: 0 } }
      );
      
      if (user) {
        user.userType = userType;
      }
      
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
};

module.exports = {
  initializePassport
};