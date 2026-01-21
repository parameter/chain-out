const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database');
const { ObjectId } = require('mongodb');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const initializePassport = () => {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    try {
      const db = getDatabase();

      console.log('trying to login', email, password);
      
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
      
      // Check email verification for regular users (not operators or service-users)
      if (userType === 'user' && user.emailVerified !== true) {
        return done(null, false, { 
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          emailNotVerified: true 
        });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      // Add userType to distinguish between users and operators
      userWithoutPassword.userType = userType;
      return done(null, userWithoutPassword);
    } catch (error) {
      return done(error);
    }
  }));

  passport.use(new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your-jwt-secret-change-this',
      algorithms: ['HS256']
    },
    async (payload, done) => {
      try {
        const db = getDatabase();

        const { sub: id } = payload;
        let collectionName = 'users';

        const collection = db.collection(collectionName);
        const objectId = typeof id === 'string' ? new ObjectId(id) : id;
        const user = await collection.findOne(
          { _id: objectId },
          { projection: { password: 0 } }
        );

        if (!user) {
          return done(null, false);
        }

        return done(null, user);
        
      } catch (err) {
        return done(err, false);
      }
    }
  ));
  
};

module.exports = {
  initializePassport
};