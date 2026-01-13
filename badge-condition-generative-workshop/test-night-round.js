// Function to check if round was started between 1 AM and 4 AM
// Uses result.timestamp to check the hour when the round started

const nightRoundFunction = (results, layout) => {
    if (!results || results.length === 0) {
        return 0;
    }
    
    // Sort results by timestamp to get chronological order
    const sortedResults = [...results].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
    });
    
    // Get the timestamp of the first hole (when round started)
    const firstTimestamp = new Date(sortedResults[0].timestamp);
    const hour = firstTimestamp.getUTCHours(); // 0-23 (0 = midnight, 1-3 = 1-3 AM, 4 = 4 AM)
    
    // Check if started between 1 AM and 4 AM (hour 1, 2, or 3)
    // Note: getUTCHours() returns 0-23, so 1-3 means 1:00 AM to 3:59 AM UTC
    return hour >= 1 && hour < 4 ? 1 : 0;
};

// Test data - Started at 1:00 AM
const results1AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T01:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T01:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T01:10:00.000Z"
  }
];

// Test data - Started at 2:30 AM
const results230AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T02:30:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T02:35:00.000Z"
  }
];

// Test data - Started at 3:59 AM
const results359AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T03:59:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T04:05:00.000Z"
  }
];

// Test data - Started at 4:00 AM (should NOT qualify)
const results4AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T04:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T04:05:00.000Z"
  }
];

// Test data - Started at 12:30 AM (midnight, should NOT qualify)
const results1230AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T00:30:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T00:35:00.000Z"
  }
];

// Test data - Started at 5:00 AM (should NOT qualify)
const results5AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T05:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T05:05:00.000Z"
  }
];

// Test data - Started at 11:00 PM (should NOT qualify)
const results11PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-14T23:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-14T23:05:00.000Z"
  }
];

// Test data - Results not in chronological order
const resultsUnsorted = [
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T02:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T02:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T02:05:00.000Z"
  }
];

const layout = {
  "holes": [
    { "number": 1, "par": 3 },
    { "number": 2, "par": 4 },
    { "number": 3, "par": 3 }
  ]
};

// Helper function to format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm} UTC (hour ${hours})`;
}

console.log("=".repeat(70));
console.log("TESTING: Night Round Function (Started between 1 AM and 4 AM)");
console.log("=".repeat(70));
console.log();

// Test 1: Started at 1:00 AM
console.log("TEST 1: Round started at 1:00 AM");
console.log("-".repeat(70));
const result1 = nightRoundFunction(results1AM, layout);
const sorted1 = [...results1AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime1 = new Date(sorted1[0].timestamp);
console.log(`  Start time: ${formatTime(startTime1)}`);
console.log(`  Result: ${result1} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 1 AM)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Started at 2:30 AM
console.log("TEST 2: Round started at 2:30 AM");
console.log("-".repeat(70));
const result2 = nightRoundFunction(results230AM, layout);
const sorted2 = [...results230AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime2 = new Date(sorted2[0].timestamp);
console.log(`  Start time: ${formatTime(startTime2)}`);
console.log(`  Result: ${result2} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 2:30 AM)`);
console.log(`  Test: ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Started at 3:59 AM
console.log("TEST 3: Round started at 3:59 AM");
console.log("-".repeat(70));
const result3 = nightRoundFunction(results359AM, layout);
const sorted3 = [...results359AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime3 = new Date(sorted3[0].timestamp);
console.log(`  Start time: ${formatTime(startTime3)}`);
console.log(`  Result: ${result3} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 3:59 AM)`);
console.log(`  Test: ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Started at 4:00 AM (should NOT qualify)
console.log("TEST 4: Round started at 4:00 AM");
console.log("-".repeat(70));
const result4 = nightRoundFunction(results4AM, layout);
const sorted4 = [...results4AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime4 = new Date(sorted4[0].timestamp);
console.log(`  Start time: ${formatTime(startTime4)}`);
console.log(`  Result: ${result4} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 4 AM, not included)`);
console.log(`  Test: ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 5: Started at 12:30 AM (should NOT qualify)
console.log("TEST 5: Round started at 12:30 AM (midnight)");
console.log("-".repeat(70));
const result5 = nightRoundFunction(results1230AM, layout);
const sorted5 = [...results1230AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime5 = new Date(sorted5[0].timestamp);
console.log(`  Start time: ${formatTime(startTime5)}`);
console.log(`  Result: ${result5} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at midnight, not included)`);
console.log(`  Test: ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 6: Started at 5:00 AM (should NOT qualify)
console.log("TEST 6: Round started at 5:00 AM");
console.log("-".repeat(70));
const result6 = nightRoundFunction(results5AM, layout);
const sorted6 = [...results5AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime6 = new Date(sorted6[0].timestamp);
console.log(`  Start time: ${formatTime(startTime6)}`);
console.log(`  Result: ${result6} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 5 AM, not included)`);
console.log(`  Test: ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 7: Started at 11:00 PM (should NOT qualify)
console.log("TEST 7: Round started at 11:00 PM");
console.log("-".repeat(70));
const result7 = nightRoundFunction(results11PM, layout);
const sorted7 = [...results11PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime7 = new Date(sorted7[0].timestamp);
console.log(`  Start time: ${formatTime(startTime7)}`);
console.log(`  Result: ${result7} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 11 PM, not included)`);
console.log(`  Test: ${result7 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 8: Results not in chronological order
console.log("TEST 8: Results not in chronological order (should still work)");
console.log("-".repeat(70));
const result8 = nightRoundFunction(resultsUnsorted, layout);
const sorted8 = [...resultsUnsorted].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime8 = new Date(sorted8[0].timestamp);
console.log(`  Start time: ${formatTime(startTime8)}`);
console.log(`  Result: ${result8} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 2 AM, works even if unsorted)`);
console.log(`  Test: ${result8 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (1:00 AM): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (2:30 AM): ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (3:59 AM): ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (4:00 AM): ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (12:30 AM): ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 6 (5:00 AM): ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 7 (11:00 PM): ${result7 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 8 (Unsorted): ${result8 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 1 && result3 === 1 && result4 === 0 && result5 === 0 && result6 === 0 && result7 === 0 && result8 === 1) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Round must have started between 1 AM and 4 AM (hour 1, 2, or 3)");
    console.log("  2. Uses the earliest timestamp to determine start time");
    console.log("  3. Works even if results are not in chronological order");
}

