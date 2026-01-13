// Function to check if player finished 18 holes within an hour
// Uses result.timestamp to calculate time difference

const eighteenHolesInHourFunction = (results, layout) => {
    if (!results || results.length < 18) {
        return 0;
    }
    
    // Sort results by timestamp to get chronological order
    const sortedResults = [...results].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
    });
    
    // Get first and last timestamps
    const firstTimestamp = new Date(sortedResults[0].timestamp).getTime();
    const lastTimestamp = new Date(sortedResults[sortedResults.length - 1].timestamp).getTime();
    
    // Calculate time difference in milliseconds
    const timeDifference = lastTimestamp - firstTimestamp;
    
    // Check if completed within 1 hour (3600000 milliseconds)
    const oneHourInMs = 60 * 60 * 1000; // 3600000 ms
    
    return timeDifference <= oneHourInMs ? 1 : 0;
};

// Test data - Completed 18 holes in 45 minutes
const results45Minutes = [];
const startTime = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 18; i++) {
    const holeTime = new Date(startTime.getTime() + (i * 2.5 * 60 * 1000)); // 2.5 minutes per hole
    results45Minutes.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Completed 18 holes in 1 hour 15 minutes
const results75Minutes = [];
const startTime2 = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 18; i++) {
    const holeTime = new Date(startTime2.getTime() + (i * 4.17 * 60 * 1000)); // ~4.17 minutes per hole
    results75Minutes.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Completed exactly 1 hour
const resultsExactly1Hour = [];
const startTime3 = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 18; i++) {
    const holeTime = new Date(startTime3.getTime() + (i * (60 / 18) * 60 * 1000)); // Exactly 1 hour total
    resultsExactly1Hour.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Completed 18 holes in 59 minutes 59 seconds
const resultsJustUnder1Hour = [];
const startTime4 = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 18; i++) {
    const totalMs = (59 * 60 + 59) * 1000; // 59 minutes 59 seconds in ms
    const holeTime = new Date(startTime4.getTime() + (i * (totalMs / 17))); // Spread over 17 intervals
    resultsJustUnder1Hour.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Completed 18 holes in 1 hour 1 second
const resultsJustOver1Hour = [];
const startTime5 = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 18; i++) {
    const totalMs = (60 * 60 + 1) * 1000; // 1 hour 1 second in ms
    const holeTime = new Date(startTime5.getTime() + (i * (totalMs / 17))); // Spread over 17 intervals
    resultsJustOver1Hour.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Only 9 holes (not enough)
const results9Holes = [];
const startTime6 = new Date('2025-01-15T10:00:00.000Z');
for (let i = 0; i < 9; i++) {
    const holeTime = new Date(startTime6.getTime() + (i * 2 * 60 * 1000)); // 2 minutes per hole
    results9Holes.push({
        "playerId": "player1",
        "holeNumber": i + 1,
        "score": 3 + (i % 3),
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": holeTime.toISOString()
    });
}

// Test data - Results not in chronological order (should still work)
const resultsUnsorted = [
    {
        "playerId": "player1",
        "holeNumber": 5,
        "score": 3,
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": "2025-01-15T10:10:00.000Z"
    },
    {
        "playerId": "player1",
        "holeNumber": 1,
        "score": 3,
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": "2025-01-15T10:00:00.000Z"
    },
    {
        "playerId": "player1",
        "holeNumber": 18,
        "score": 3,
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": "2025-01-15T10:55:00.000Z"
    },
    {
        "playerId": "player1",
        "holeNumber": 10,
        "score": 3,
        "putt": "inside",
        "obCount": 0,
        "specifics": {},
        "timestamp": "2025-01-15T10:30:00.000Z"
    }
];
// Fill in missing holes to make 18 total
for (let i = 1; i <= 18; i++) {
    if (!resultsUnsorted.find(r => r.holeNumber === i)) {
        const baseTime = new Date('2025-01-15T10:00:00.000Z');
        const holeTime = new Date(baseTime.getTime() + (i * 3 * 60 * 1000)); // 3 minutes per hole
        resultsUnsorted.push({
            "playerId": "player1",
            "holeNumber": i,
            "score": 3,
            "putt": "inside",
            "obCount": 0,
            "specifics": {},
            "timestamp": holeTime.toISOString()
        });
    }
}

const layout = {
  "holes": [
    { "number": 1, "par": 3 },
    { "number": 2, "par": 4 },
    { "number": 3, "par": 3 },
    { "number": 4, "par": 4 },
    { "number": 5, "par": 3 },
    { "number": 6, "par": 4 },
    { "number": 7, "par": 3 },
    { "number": 8, "par": 4 },
    { "number": 9, "par": 3 },
    { "number": 10, "par": 4 },
    { "number": 11, "par": 3 },
    { "number": 12, "par": 4 },
    { "number": 13, "par": 3 },
    { "number": 14, "par": 4 },
    { "number": 15, "par": 3 },
    { "number": 16, "par": 4 },
    { "number": 17, "par": 3 },
    { "number": 18, "par": 4 }
  ]
};

// Helper function to format time difference
function formatTimeDifference(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${minutes}m ${seconds}s`;
}

console.log("=".repeat(70));
console.log("TESTING: 18 Holes in 1 Hour Function");
console.log("=".repeat(70));
console.log();

// Test 1: Completed in 45 minutes
console.log("TEST 1: Completed 18 holes in 45 minutes");
console.log("-".repeat(70));
const result1 = eighteenHolesInHourFunction(results45Minutes, layout);
const first1 = new Date(results45Minutes[0].timestamp);
const last1 = new Date(results45Minutes[results45Minutes.length - 1].timestamp);
const diff1 = last1.getTime() - first1.getTime();
console.log(`  First hole: ${first1.toISOString()}`);
console.log(`  Last hole: ${last1.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff1)}`);
console.log(`  Result: ${result1} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 1 (completed in 45 minutes)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Completed in 1 hour 15 minutes
console.log("TEST 2: Completed 18 holes in 1 hour 15 minutes");
console.log("-".repeat(70));
const result2 = eighteenHolesInHourFunction(results75Minutes, layout);
const sorted2 = [...results75Minutes].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const first2 = new Date(sorted2[0].timestamp);
const last2 = new Date(sorted2[sorted2.length - 1].timestamp);
const diff2 = last2.getTime() - first2.getTime();
console.log(`  First hole: ${first2.toISOString()}`);
console.log(`  Last hole: ${last2.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff2)}`);
console.log(`  Result: ${result2} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 0 (took 1h 15m)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Completed exactly 1 hour
console.log("TEST 3: Completed 18 holes in exactly 1 hour");
console.log("-".repeat(70));
const result3 = eighteenHolesInHourFunction(resultsExactly1Hour, layout);
const sorted3 = [...resultsExactly1Hour].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const first3 = new Date(sorted3[0].timestamp);
const last3 = new Date(sorted3[sorted3.length - 1].timestamp);
const diff3 = last3.getTime() - first3.getTime();
console.log(`  First hole: ${first3.toISOString()}`);
console.log(`  Last hole: ${last3.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff3)}`);
console.log(`  Result: ${result3} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 1 (exactly 1 hour)`);
console.log(`  Test: ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Completed in 59 minutes 59 seconds
console.log("TEST 4: Completed 18 holes in 59 minutes 59 seconds");
console.log("-".repeat(70));
const result4 = eighteenHolesInHourFunction(resultsJustUnder1Hour, layout);
const sorted4 = [...resultsJustUnder1Hour].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const first4 = new Date(sorted4[0].timestamp);
const last4 = new Date(sorted4[sorted4.length - 1].timestamp);
const diff4 = last4.getTime() - first4.getTime();
console.log(`  First hole: ${first4.toISOString()}`);
console.log(`  Last hole: ${last4.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff4)}`);
console.log(`  Result: ${result4} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 1 (just under 1 hour)`);
console.log(`  Test: ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 5: Completed in 1 hour 1 second
console.log("TEST 5: Completed 18 holes in 1 hour 1 second");
console.log("-".repeat(70));
const result5 = eighteenHolesInHourFunction(resultsJustOver1Hour, layout);
const sorted5 = [...resultsJustOver1Hour].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const first5 = new Date(sorted5[0].timestamp);
const last5 = new Date(sorted5[sorted5.length - 1].timestamp);
const diff5 = last5.getTime() - first5.getTime();
console.log(`  First hole: ${first5.toISOString()}`);
console.log(`  Last hole: ${last5.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff5)}`);
console.log(`  Result: ${result5} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 0 (just over 1 hour)`);
console.log(`  Test: ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 6: Only 9 holes
console.log("TEST 6: Only 9 holes completed");
console.log("-".repeat(70));
const result6 = eighteenHolesInHourFunction(results9Holes, layout);
console.log(`  Holes completed: ${results9Holes.length}`);
console.log(`  Result: ${result6} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 0 (need 18 holes)`);
console.log(`  Test: ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 7: Results not in chronological order
console.log("TEST 7: Results not in chronological order (should still work)");
console.log("-".repeat(70));
const result7 = eighteenHolesInHourFunction(resultsUnsorted, layout);
const sorted7 = [...resultsUnsorted].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const first7 = new Date(sorted7[0].timestamp);
const last7 = new Date(sorted7[sorted7.length - 1].timestamp);
const diff7 = last7.getTime() - first7.getTime();
console.log(`  Holes: ${resultsUnsorted.length}`);
console.log(`  First hole (by timestamp): ${first7.toISOString()}`);
console.log(`  Last hole (by timestamp): ${last7.toISOString()}`);
console.log(`  Time difference: ${formatTimeDifference(diff7)}`);
console.log(`  Result: ${result7} (1 = completed in ≤1 hour, 0 = not)`);
console.log(`  Expected: 1 (completed in ~55 minutes)`);
console.log(`  Test: ${result7 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (45 minutes): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (1h 15m): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Exactly 1h): ${result3 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (59m 59s): ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (1h 1s): ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 6 (Only 9 holes): ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 7 (Unsorted): ${result7 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 1 && result4 === 1 && result5 === 0 && result6 === 0 && result7 === 1) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Player must have completed 18 holes");
    console.log("  2. Time between first and last hole must be ≤ 1 hour");
    console.log("  3. Works even if results are not in chronological order");
}

