const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { initializePassport } = require('./config/passport');
const { initializeDatabase } = require('./config/database');

const app = express();

// Middleware
app.use(helmet());
app.set('trust proxy', 1);
app.use(morgan('combined'));

app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map(s => s.trim().replace(/\/$/, '')); // normalize trailing slash
    if (!origin) return cb(null, true);
    const norm = origin.replace(/\/$/, '');
    cb(null, allowed.includes(norm));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  optionsSuccessStatus: 204
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (works in serverless because the store is Mongo)
app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
      || process.env.MONGO_URL
      || process.env.SCALINGO_MONGO_URL
      || 'mongodb://localhost:27017/tidsrapportering',
    touchAfter: 24 * 3600
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
initializePassport();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Initialize DB once per cold start
const ready = initializeDatabase();

var server = app.listen(process.env.PORT || 5000, function () {
  var host = server.address().address
  var port = server.address().port
  console.log('App listening at http://%s:%s', host, port)
})