// Function to check if player made two aces (hole-in-ones) during one round
// Badge: "Gör två ace under en runda" (Make two aces during one round)

const twoAcesFunction = (results, layout) => {
    if (!results || results.length === 0) {
        return 0;
    }
    
    // Count how many aces (score === 1) the player made
    const aceCount = results.filter((r) => r.score === 1).length;
    
    // Return 1 if player made at least 2 aces, 0 otherwise
    return aceCount >= 2 ? 1 : 0;
};

// Test data - Player made 2 aces
const results2Aces = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Player made 3 aces (more than 2)
const results3Aces = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Player made only 1 ace
const results1Ace = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Player made no aces
const resultsNoAces = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Birdie (no ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

const layout = {
  "holes": [
    { "number": 1, "par": 3 },
    { "number": 2, "par": 4 },
    { "number": 3, "par": 3 },
    { "number": 4, "par": 4 },
    { "number": 5, "par": 3 },
    { "number": 6, "par": 4 }
  ]
};

// Helper function to find aces
function findAces(results) {
    return results.filter(r => r.score === 1);
}

console.log("=".repeat(70));
console.log("TESTING: Two Aces Function");
console.log("Badge: 'Gör två ace under en runda'");
console.log("=".repeat(70));
console.log();

// Test 1: Player made 2 aces
console.log("TEST 1: Player made 2 aces");
console.log("-".repeat(70));
const result1 = twoAcesFunction(results2Aces, layout);
const aces1 = findAces(results2Aces);
console.log("  Score breakdown:");
results2Aces.forEach(r => {
    const desc = r.score === 1 ? "ACE!" : `${r.score}`;
    console.log(`    Hole ${r.holeNumber}: ${r.score} ${desc === "ACE!" ? "⭐ " + desc : ""}`);
});
console.log(`  Aces found: ${aces1.length} (on hole${aces1.length > 1 ? 's' : ''} ${aces1.map(a => a.holeNumber).join(', ')})`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (made 2 aces)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Player made 3 aces (more than 2)
console.log("TEST 2: Player made 3 aces (more than 2)");
console.log("-".repeat(70));
const result2 = twoAcesFunction(results3Aces, layout);
const aces2 = findAces(results3Aces);
console.log("  Score breakdown:");
results3Aces.forEach(r => {
    const desc = r.score === 1 ? "ACE!" : `${r.score}`;
    console.log(`    Hole ${r.holeNumber}: ${r.score} ${desc === "ACE!" ? "⭐ " + desc : ""}`);
});
console.log(`  Aces found: ${aces2.length} (on hole${aces2.length > 1 ? 's' : ''} ${aces2.map(a => a.holeNumber).join(', ')})`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (made 3 aces, which is >= 2)`);
console.log(`  Test: ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Player made only 1 ace
console.log("TEST 3: Player made only 1 ace");
console.log("-".repeat(70));
const result3 = twoAcesFunction(results1Ace, layout);
const aces3 = findAces(results1Ace);
console.log("  Score breakdown:");
results1Ace.forEach(r => {
    const desc = r.score === 1 ? "ACE!" : `${r.score}`;
    console.log(`    Hole ${r.holeNumber}: ${r.score} ${desc === "ACE!" ? "⭐ " + desc : ""}`);
});
console.log(`  Aces found: ${aces3.length} (on hole${aces3.length > 1 ? 's' : ''} ${aces3.map(a => a.holeNumber).join(', ')})`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (only 1 ace, need 2)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Player made no aces
console.log("TEST 4: Player made no aces");
console.log("-".repeat(70));
const result4 = twoAcesFunction(resultsNoAces, layout);
const aces4 = findAces(resultsNoAces);
console.log("  Score breakdown:");
resultsNoAces.forEach(r => {
    console.log(`    Hole ${r.holeNumber}: ${r.score}`);
});
console.log(`  Aces found: ${aces4.length}`);
console.log(`  Result: ${result4} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (no aces)`);
console.log(`  Test: ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (2 aces): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (3 aces): ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (1 ace): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (0 aces): ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 1 && result3 === 0 && result4 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Player must have made at least 2 aces (score === 1)");
    console.log("  2. Counts all aces in the round");
}

