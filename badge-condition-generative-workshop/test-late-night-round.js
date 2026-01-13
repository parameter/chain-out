// Function to check if round was started between 23:00 (11 PM) and 00:59 (12:59 AM)
// This spans midnight, so it includes hour 23 (11 PM-11:59 PM) and hour 0 (12 AM-12:59 AM)

const lateNightRoundFunction = (results, layout) => {
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
    const hour = firstTimestamp.getUTCHours(); // 0-23
    
    // Check if started between 23:00 and 00:59
    // This means hour 23 (11 PM-11:59 PM) OR hour 0 (12 AM-12:59 AM)
    return hour === 23 || hour === 0 ? 1 : 0;
};

// Test data - Started at 23:00 (11:00 PM)
const results11PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:10:00.000Z"
  }
];

// Test data - Started at 23:30 (11:30 PM)
const results1130PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:30:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:35:00.000Z"
  }
];

// Test data - Started at 23:59 (11:59 PM)
const results1159PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:59:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:05:00.000Z"
  }
];

// Test data - Started at 00:00 (12:00 AM / midnight)
const resultsMidnight = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:05:00.000Z"
  }
];

// Test data - Started at 00:30 (12:30 AM)
const results1230AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:30:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:35:00.000Z"
  }
];

// Test data - Started at 00:59 (12:59 AM)
const results1259AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:59:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T01:05:00.000Z"
  }
];

// Test data - Started at 01:00 (1:00 AM - should NOT qualify)
const results1AM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T01:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T01:05:00.000Z"
  }
];

// Test data - Started at 22:59 (10:59 PM - should NOT qualify)
const results1059PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T22:59:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T23:05:00.000Z"
  }
];

// Test data - Started at 10:00 PM (should NOT qualify)
const results10PM = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T22:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T22:05:00.000Z"
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
    "timestamp": "2025-01-16T00:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-16T00:05:00.000Z"
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
console.log("TESTING: Late Night Round Function (Started between 23:00 and 00:59)");
console.log("=".repeat(70));
console.log();

// Test 1: Started at 23:00 (11:00 PM)
console.log("TEST 1: Round started at 23:00 (11:00 PM)");
console.log("-".repeat(70));
const result1 = lateNightRoundFunction(results11PM, layout);
const sorted1 = [...results11PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime1 = new Date(sorted1[0].timestamp);
console.log(`  Start time: ${formatTime(startTime1)}`);
console.log(`  Result: ${result1} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 11 PM)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Started at 23:30 (11:30 PM)
console.log("TEST 2: Round started at 23:30 (11:30 PM)");
console.log("-".repeat(70));
const result2 = lateNightRoundFunction(results1130PM, layout);
const sorted2 = [...results1130PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime2 = new Date(sorted2[0].timestamp);
console.log(`  Start time: ${formatTime(startTime2)}`);
console.log(`  Result: ${result2} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 11:30 PM)`);
console.log(`  Test: ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Started at 23:59 (11:59 PM)
console.log("TEST 3: Round started at 23:59 (11:59 PM)");
console.log("-".repeat(70));
const result3 = lateNightRoundFunction(results1159PM, layout);
const sorted3 = [...results1159PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime3 = new Date(sorted3[0].timestamp);
console.log(`  Start time: ${formatTime(startTime3)}`);
console.log(`  Result: ${result3} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 11:59 PM)`);
console.log(`  Test: ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Started at 00:00 (12:00 AM / midnight)
console.log("TEST 4: Round started at 00:00 (12:00 AM / midnight)");
console.log("-".repeat(70));
const result4 = lateNightRoundFunction(resultsMidnight, layout);
const sorted4 = [...resultsMidnight].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime4 = new Date(sorted4[0].timestamp);
console.log(`  Start time: ${formatTime(startTime4)}`);
console.log(`  Result: ${result4} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at midnight)`);
console.log(`  Test: ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 5: Started at 00:30 (12:30 AM)
console.log("TEST 5: Round started at 00:30 (12:30 AM)");
console.log("-".repeat(70));
const result5 = lateNightRoundFunction(results1230AM, layout);
const sorted5 = [...results1230AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime5 = new Date(sorted5[0].timestamp);
console.log(`  Start time: ${formatTime(startTime5)}`);
console.log(`  Result: ${result5} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 12:30 AM)`);
console.log(`  Test: ${result5 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 6: Started at 00:59 (12:59 AM)
console.log("TEST 6: Round started at 00:59 (12:59 AM)");
console.log("-".repeat(70));
const result6 = lateNightRoundFunction(results1259AM, layout);
const sorted6 = [...results1259AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime6 = new Date(sorted6[0].timestamp);
console.log(`  Start time: ${formatTime(startTime6)}`);
console.log(`  Result: ${result6} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at 12:59 AM)`);
console.log(`  Test: ${result6 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 7: Started at 01:00 (1:00 AM - should NOT qualify)
console.log("TEST 7: Round started at 01:00 (1:00 AM)");
console.log("-".repeat(70));
const result7 = lateNightRoundFunction(results1AM, layout);
const sorted7 = [...results1AM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime7 = new Date(sorted7[0].timestamp);
console.log(`  Start time: ${formatTime(startTime7)}`);
console.log(`  Result: ${result7} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 1 AM, not included)`);
console.log(`  Test: ${result7 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 8: Started at 22:59 (10:59 PM - should NOT qualify)
console.log("TEST 8: Round started at 22:59 (10:59 PM)");
console.log("-".repeat(70));
const result8 = lateNightRoundFunction(results1059PM, layout);
const sorted8 = [...results1059PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime8 = new Date(sorted8[0].timestamp);
console.log(`  Start time: ${formatTime(startTime8)}`);
console.log(`  Result: ${result8} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 10:59 PM, not included)`);
console.log(`  Test: ${result8 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 9: Started at 22:00 (10:00 PM - should NOT qualify)
console.log("TEST 9: Round started at 22:00 (10:00 PM)");
console.log("-".repeat(70));
const result9 = lateNightRoundFunction(results10PM, layout);
const sorted9 = [...results10PM].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime9 = new Date(sorted9[0].timestamp);
console.log(`  Start time: ${formatTime(startTime9)}`);
console.log(`  Result: ${result9} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 0 (started at 10 PM, not included)`);
console.log(`  Test: ${result9 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 10: Results not in chronological order
console.log("TEST 10: Results not in chronological order (should still work)");
console.log("-".repeat(70));
const result10 = lateNightRoundFunction(resultsUnsorted, layout);
const sorted10 = [...resultsUnsorted].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const startTime10 = new Date(sorted10[0].timestamp);
console.log(`  Start time: ${formatTime(startTime10)}`);
console.log(`  Result: ${result10} (1 = qualifies, 0 = not)`);
console.log(`  Expected: 1 (started at midnight, works even if unsorted)`);
console.log(`  Test: ${result10 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (23:00 / 11 PM): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (23:30 / 11:30 PM): ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (23:59 / 11:59 PM): ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (00:00 / midnight): ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (00:30 / 12:30 AM): ${result5 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 6 (00:59 / 12:59 AM): ${result6 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 7 (01:00 / 1 AM): ${result7 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 8 (22:59 / 10:59 PM): ${result8 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 9 (22:00 / 10 PM): ${result9 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 10 (Unsorted): ${result10 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 1 && result3 === 1 && result4 === 1 && result5 === 1 && 
    result6 === 1 && result7 === 0 && result8 === 0 && result9 === 0 && result10 === 1) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Round must have started between 23:00 and 00:59 (hour 23 or 0)");
    console.log("  2. Uses the earliest timestamp to determine start time");
    console.log("  3. Works even if results are not in chronological order");
}

