// Complete test for bogey-free win/loss function
// Tests: "Förlora en match trots att man gått bogey free" (Lose a match despite being bogey-free)

const testFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Handle both array of arrays and flat array
    const flatResults = Array.isArray(allOtherPlayersResults[0]) && Array.isArray(allOtherPlayersResults[0][0]) === false
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
    
    return currentPlayerTotal < bestOpponentTotal ? 1 : 0;
};

// Helper function to check if player is bogey-free
function isBogeyFree(results, layout) {
    return results.every((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score <= hole.par;
    });
}

// Helper function to count bogeys
function countBogeys(results, layout) {
    return results.filter((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score === hole.par + 1;
    }).length;
}

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

// SCENARIO 1: Player WON with bogey-free round
const scenario1_opponents = [[
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
    "score": 4,  // par
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
    "score": 4,  // par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

// SCENARIO 2: Player LOST despite bogey-free round (THE KEY TEST CASE)
const scenario2_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // birdie (same as player)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 2,  // eagle (better than player's par)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,  // birdie (better than player's par)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 3,  // birdie (same as player)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 2,  // birdie (better than player's par)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 3,  // birdie (same as player)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
]];

console.log("=".repeat(60));
console.log("TESTING: Bogey-Free Win/Loss Function");
console.log("=".repeat(60));
console.log();

// Analyze player's round
const playerTotal = results.reduce((sum, r) => sum + r.score, 0);
const bogeyFree = isBogeyFree(results, layout);
const bogeys = countBogeys(results, layout);

console.log("PLAYER ROUND ANALYSIS:");
console.log(`  Total Score: ${playerTotal}`);
console.log(`  Bogey-Free: ${bogeyFree ? 'YES ✓' : 'NO ✗'}`);
console.log(`  Number of Bogeys: ${bogeys}`);
console.log(`  Score breakdown:`);
results.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const diff = hole ? r.score - hole.par : 0;
    const label = diff === -2 ? 'EAGLE' : diff === -1 ? 'BIRDIE' : diff === 0 ? 'PAR' : diff === 1 ? 'BOGEY' : diff === 2 ? 'DOUBLE' : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${label})`);
});
console.log();

// Test Scenario 1: Win with bogey-free
console.log("-".repeat(60));
console.log("SCENARIO 1: Player WON with bogey-free round");
console.log("-".repeat(60));
const opponent1Total = scenario1_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const result1 = testFunction(results, layout, scenario1_opponents);
console.log(`  Player Score: ${playerTotal}`);
console.log(`  Opponent Score: ${opponent1Total}`);
console.log(`  Result: ${result1 === 1 ? 'WON ✓' : 'LOST/TIE ✗'}`);
console.log(`  Expected: WON`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test Scenario 2: Lost despite bogey-free (THE KEY TEST)
console.log("-".repeat(60));
console.log("SCENARIO 2: Player LOST despite bogey-free round");
console.log("           (Förlora en match trots att man gått bogey free)");
console.log("-".repeat(60));
const opponent2Total = scenario2_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const result2 = testFunction(results, layout, scenario2_opponents);
console.log(`  Player Score: ${playerTotal}`);
console.log(`  Opponent Score: ${opponent2Total}`);
console.log(`  Result: ${result2 === 1 ? 'WON ✓' : 'LOST/TIE ✗'}`);
console.log(`  Expected: LOST (despite being bogey-free!)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Summary
console.log("=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log(`Player was bogey-free: ${bogeyFree ? 'YES' : 'NO'}`);
console.log(`Scenario 1 (Win): ${result1 === 1 ? 'PASS' : 'FAIL'}`);
console.log(`Scenario 2 (Loss despite bogey-free): ${result2 === 0 ? 'PASS' : 'FAIL'}`);
console.log();

if (bogeyFree && result2 === 0) {
    console.log("✓ SUCCESS: Function correctly identifies that player lost");
    console.log("  despite being bogey-free (the badge condition is met)");
} else if (bogeyFree && result2 === 1) {
    console.log("✗ ISSUE: Function incorrectly says player won");
    console.log("  when they actually lost despite being bogey-free");
} else {
    console.log("⚠ Note: Player was not bogey-free in this test");
}

