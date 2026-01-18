# Stats Route Testing

This directory contains test scripts for the `/stats/general` route.

## Test Files

1. **test-stats-route.js** - Direct database test (no HTTP server required)
2. **test-stats-route-http.js** - HTTP API test (requires running server)

## Test User ID

Both tests use the user ID: `68da392e41254148ddea8883`

## Running the Tests

### Option 1: Direct Database Test

This test directly queries the database without needing a running server:

```bash
node test-stats-route.js
```

**Requirements:**
- MongoDB connection configured in `.env` (MONGODB_URI)
- Database must be accessible

**What it tests:**
- All aggregation queries
- Weekly streak calculation
- Badge tier counting
- All statistics calculations

### Option 2: HTTP API Test

This test makes an actual HTTP request to the API endpoint:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Run the HTTP test
node test-stats-route-http.js
```

**Requirements:**
- Server must be running on `http://localhost:5000` (or set `API_URL` env variable)
- JWT_SECRET must match server configuration
- User must exist in database

**What it tests:**
- Full HTTP request/response cycle
- JWT authentication
- API endpoint integration
- Response format validation

## Environment Variables

Make sure these are set in your `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your-jwt-secret-change-this
API_URL=http://localhost:5000  # Only needed for HTTP test
```

## Expected Output

Both tests will output:
- Rounds count
- Unique courses count
- Total badges count
- Verified percentage
- Weekly streak
- Achievements count
- Badge counts by tier (bronze, silver, gold, platinum, diamond, emerald, ruby, cosmic)

## Troubleshooting

### Database Connection Error
- Check `MONGODB_URI` in `.env`
- Ensure MongoDB is running and accessible

### HTTP Test Connection Refused
- Make sure server is running (`npm run dev`)
- Check if server is on correct port (default: 5000)
- Verify `API_URL` matches server address

### Authentication Error
- Ensure `JWT_SECRET` matches server configuration
- Verify user ID exists in database
- Check user collection name matches configuration

