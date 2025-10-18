const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { initializePassport } = require('./config/passport');
const { initializeDatabase } = require('./config/database');

const app = express();

app.use(helmet());
app.set('trust proxy', 1);
app.use(morgan('combined'));

// Define an array of allowed URLs (can be set via env or hardcoded)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000'
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach(url => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const norm = origin.replace(/\/$/, '');
    cb(null, allowedOrigins.includes(norm));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  optionsSuccessStatus: 204
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

app.use(passport.initialize());
initializePassport();

// Initialize DB once per cold start and gate requests until ready
app.use((req, res, next) => {
  ready.then(() => next()).catch(next);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/admin', adminRoutes);

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