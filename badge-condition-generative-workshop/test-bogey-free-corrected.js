// CORRECTED function that checks for bogey-free AND win/loss
// Badge: "Förlora en match trots att man gått bogey free" (Lose a match despite being bogey-free)

const correctedFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Check if player is bogey-free (no scores above par)
    const isBogeyFree = results.every((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score <= hole.par;
    });
    
    // If player has bogeys, this badge condition is not met
    if (!isBogeyFree) {
        return 0;
    }
    
    // Flatten array of arrays if needed
    const flatResults = Array.isArray(allOtherPlayersResults[0]) && 
                       !allOtherPlayersResults[0].hasOwnProperty('playerId')
        ? allOtherPlayersResults.flat()
        : allOtherPlayersResults;
    
    const opponentTotals = {};
    for (const otherResult of flatResults) {
        const playerId = String(otherResult.playerId);
        if (!opponentTotals[playerId]) {
            opponentTotals[playerId] = 0;
        }
        opponentTotals[playerId] += otherResult.score;
    }
    
    const bestOpponentTotal = Math.min(...Object.values(opponentTotals));
    const currentPlayerTotal = results.reduce((sum, r) => sum + r.score, 0);
    
    // Return 1 only if player lost (or tied) despite being bogey-free
    // Note: In golf, lower score wins, so if currentPlayerTotal >= bestOpponentTotal, player lost/tied
    return currentPlayerTotal >= bestOpponentTotal ? 1 : 0;
};

// Test data
const results = [
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 1,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 2,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 5,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 6,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {
      "c1": false,
      "c2": false,
      "bullseye": false,
      "scramble": false,
      "throwIn": false
    },
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

const layout = {
  "holes": [
    {
      "number": 1,
      "par": 3
    },
    {
      "number": 2,
      "par": 4
    },
    {
      "number": 3,
      "par": 3
    },
    {
      "number": 4,
      "par": 4
    },
    {
      "number": 5,
      "par": 3
    },
    {
      "number": 6,
      "par": 4
    },
    {
      "number": 7,
      "par": 3
    },
    {
      "number": 8,
      "par": 4
    },
    {
      "number": 9,
      "par": 3
    }
  ]
};

// Test Case 1: Player LOST despite bogey-free (should return 1)
const test1_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 2,  // eagle - better than player
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,  // birdie - better than player
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 2,  // birdie - better than player
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

// Test Case 2: Player WON with bogey-free (should return 0 - badge not earned)
const test2_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 5,  // bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 4,  // bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 4,  // bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

// Test Case 3: Player LOST but had bogeys (should return 0 - not bogey-free)
const test3_results = [
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 1,
    "score": 2,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 2,
    "score": 5,  // BOGEY
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 4,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 5,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 6,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

console.log("=".repeat(70));
console.log("CORRECTED FUNCTION TEST: Bogey-Free Loss Detection");
console.log("=".repeat(70));
console.log();

// Test 1: Lost despite bogey-free (should return 1)
console.log("TEST 1: Player LOST despite bogey-free round");
console.log("-".repeat(70));
const result1 = correctedFunction(results, layout, test1_opponents);
const playerTotal1 = results.reduce((sum, r) => sum + r.score, 0);
const opponentTotal1 = test1_opponents.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`  Player Score: ${playerTotal1} (bogey-free: YES)`);
console.log(`  Opponent Score: ${opponentTotal1}`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (lost despite bogey-free)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Won with bogey-free (should return 0)
console.log("TEST 2: Player WON with bogey-free round");
console.log("-".repeat(70));
const result2 = correctedFunction(results, layout, test2_opponents);
const playerTotal2 = results.reduce((sum, r) => sum + r.score, 0);
const opponentTotal2 = test2_opponents.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`  Player Score: ${playerTotal2} (bogey-free: YES)`);
console.log(`  Opponent Score: ${opponentTotal2}`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (won, so badge not earned)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Lost but had bogeys (should return 0)
console.log("TEST 3: Player LOST but had bogeys (not bogey-free)");
console.log("-".repeat(70));
const result3 = correctedFunction(test3_results, layout, test1_opponents);
const playerTotal3 = test3_results.reduce((sum, r) => sum + r.score, 0);
console.log(`  Player Score: ${playerTotal3} (bogey-free: NO - has bogeys)`);
console.log(`  Opponent Score: ${opponentTotal1}`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (not bogey-free, so badge not earned)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Lost + Bogey-Free): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Won + Bogey-Free): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Lost + Has Bogeys): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks for:");
    console.log("  1. Player must be bogey-free");
    console.log("  2. Player must have lost (or tied)");
}

