// Function to check if player lost despite getting an ace
// Badge: "Förlora en match trots att man fått ace" (Lose a match despite getting an ace)

const aceLossFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Check if player got an ace (hole-in-one, score === 1)
    const hasAce = results.some((r) => r.score === 1);
    
    // If player didn't get an ace, this badge condition is not met
    if (!hasAce) {
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
    
    // Return 1 only if player lost (or tied) despite getting an ace
    // In golf, lower score wins, so if currentPlayerTotal >= bestOpponentTotal, player lost/tied
    return currentPlayerTotal >= bestOpponentTotal ? 1 : 0;
};

// Test data - Player with an ace
const resultsWithAce = [
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
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

// Test data - Player without an ace
const resultsWithoutAce = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // birdie, no ace
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
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

// Test Case 1: Player LOST despite getting an ace (should return 1)
const test1_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // birdie - better than ace on this hole, but overall better
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 3,  // birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,  // birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 3,  // birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 2,  // birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 3,  // birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

// Test Case 2: Player WON despite getting an ace (should return 0)
const test2_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 3,  // par
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
    "score": 5,  // bogey
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
    "score": 5,  // bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

// Test Case 3: Player LOST but didn't get an ace (should return 0)
const test3_opponents = [[
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
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,
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
    "score": 2,
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

console.log("=".repeat(70));
console.log("TESTING: Ace Loss Function");
console.log("Badge: 'Förlora en match trots att man fått ace'");
console.log("=".repeat(70));
console.log();

// Helper function to find aces
function findAces(results) {
    return results.filter(r => r.score === 1);
}

// Test 1: Lost despite ace
console.log("TEST 1: Player LOST despite getting an ace");
console.log("-".repeat(70));
const result1 = aceLossFunction(resultsWithAce, layout, test1_opponents);
const playerTotal1 = resultsWithAce.reduce((sum, r) => sum + r.score, 0);
const opponentTotal1 = test1_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces1 = findAces(resultsWithAce);
console.log(`  Player Score: ${playerTotal1}`);
console.log(`  Player Aces: ${aces1.length} (on hole${aces1.length > 1 ? 's' : ''} ${aces1.map(a => a.holeNumber).join(', ')})`);
console.log(`  Opponent Score: ${opponentTotal1}`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (lost despite ace)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Won despite ace
console.log("TEST 2: Player WON despite getting an ace");
console.log("-".repeat(70));
const result2 = aceLossFunction(resultsWithAce, layout, test2_opponents);
const playerTotal2 = resultsWithAce.reduce((sum, r) => sum + r.score, 0);
const opponentTotal2 = test2_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces2 = findAces(resultsWithAce);
console.log(`  Player Score: ${playerTotal2}`);
console.log(`  Player Aces: ${aces2.length} (on hole${aces2.length > 1 ? 's' : ''} ${aces2.map(a => a.holeNumber).join(', ')})`);
console.log(`  Opponent Score: ${opponentTotal2}`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (won, so badge not earned)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Lost but no ace
console.log("TEST 3: Player LOST but didn't get an ace");
console.log("-".repeat(70));
const result3 = aceLossFunction(resultsWithoutAce, layout, test3_opponents);
const playerTotal3 = resultsWithoutAce.reduce((sum, r) => sum + r.score, 0);
const opponentTotal3 = test3_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces3 = findAces(resultsWithoutAce);
console.log(`  Player Score: ${playerTotal3}`);
console.log(`  Player Aces: ${aces3.length}`);
console.log(`  Opponent Score: ${opponentTotal3}`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (no ace, so badge not earned)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Lost + Ace): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Won + Ace): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Lost + No Ace): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks for:");
    console.log("  1. Player must have gotten an ace (score === 1)");
    console.log("  2. Player must have lost (or tied)");
}

