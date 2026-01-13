// Test function for bogey-free win/loss detection

const testFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    const opponentTotals = {};
    // Handle both array of arrays and flat array
    const flatResults = allOtherPlayersResults.flat();
    
    for (const otherResult of flatResults) {
        const playerId = String(otherResult.playerId);
        if (!opponentTotals[playerId]) {
            opponentTotals[playerId] = 0;
        }
        opponentTotals[playerId] += otherResult.score;
    }
    
    const bestOpponentTotal = Math.min(...Object.values(opponentTotals));
    const currentPlayerTotal = results.reduce((sum, r) => sum + r.score, 0);
    
    return currentPlayerTotal < bestOpponentTotal ? 1 : 0;
};

// Helper function to check if player is bogey-free
function isBogeyFree(results, layout) {
    return results.every((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score <= hole.par;
    });
}

// Test data from user
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

// Test Case 1: Player won with bogey-free round (opponent has worse score)
const allOtherPlayersResults1 = [[
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
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 4,
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
    "score": 4,
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

// Test Case 2: Player lost despite bogey-free round (opponent has better score)
const allOtherPlayersResults2 = [[
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

// Test Case 3: Using the original data structure from user
const allOtherPlayersResults3 = [
  [
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
  ]
];

// Run tests
console.log("=== Testing Bogey-Free Win/Loss Function ===\n");

// Check if player is bogey-free
const bogeyFree = isBogeyFree(results, layout);
console.log(`Player is bogey-free: ${bogeyFree}`);
console.log(`Player total score: ${results.reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Par breakdown: ${results.map(r => {
  const hole = layout.holes.find(h => h.number === r.holeNumber);
  return `Hole ${r.holeNumber}: ${r.score} (par ${hole ? hole.par : '?'})`;
}).join(', ')}\n`);

// Test Case 1: Win with bogey-free
console.log("--- Test Case 1: Player WON with bogey-free round ---");
const result1 = testFunction(results, layout, allOtherPlayersResults1);
const opponent1Total = allOtherPlayersResults1.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`Player score: ${results.reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Opponent score: ${opponent1Total}`);
console.log(`Function result: ${result1} (1 = won, 0 = lost)`);
console.log(`Expected: 1 (player won)`);
console.log(`Test: ${result1 === 1 ? 'PASS' : 'FAIL'}\n`);

// Test Case 2: Lost despite bogey-free
console.log("--- Test Case 2: Player LOST despite bogey-free round ---");
const result2 = testFunction(results, layout, allOtherPlayersResults2);
const opponent2Total = allOtherPlayersResults2.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`Player score: ${results.reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Opponent score: ${opponent2Total}`);
console.log(`Function result: ${result2} (1 = won, 0 = lost)`);
console.log(`Expected: 0 (player lost)`);
console.log(`Test: ${result2 === 0 ? 'PASS' : 'FAIL'}\n`);

// Test Case 3: Original data (tie scenario)
console.log("--- Test Case 3: Using original data structure (tie scenario) ---");
const result3 = testFunction(results, layout, allOtherPlayersResults3);
const opponent3Total = allOtherPlayersResults3.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`Player score: ${results.reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Opponent score: ${opponent3Total}`);
console.log(`Function result: ${result3} (1 = won, 0 = lost)`);
console.log(`Note: This is a tie (same scores), function returns 0 (lost/tie)\n`);

// Summary
console.log("=== Summary ===");
console.log(`Bogey-free check: ${bogeyFree ? 'YES - Player had no bogeys' : 'NO - Player had bogeys'}`);
console.log(`Test Case 1 (Win): ${result1 === 1 ? 'PASS' : 'FAIL'}`);
console.log(`Test Case 2 (Loss): ${result2 === 0 ? 'PASS' : 'FAIL'}`);

