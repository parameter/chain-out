// Function to check if player won with an ace
// Badge: "Vinn en match med ace" (Win a match with an ace)

const winWithAceFunction = (results, layout, allOtherPlayersResults) => {
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
    
    // Return 1 only if player won with an ace
    // In golf, lower score wins, so if currentPlayerTotal < bestOpponentTotal, player won
    return currentPlayerTotal < bestOpponentTotal ? 1 : 0;
};

// Test data - Player won with an ace
const resultsWithAceWin = [
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
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 3,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

// Test data - Player lost with an ace
const resultsWithAceLoss = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // ACE!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 5,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 5,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

// Test data - Player won but no ace
const resultsNoAceWin = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Birdie (no ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 3,  // Birdie
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

// Test Case 1: Player WON with an ace (should return 1)
const test1_opponents = [[
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
    "score": 4,  // par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 3,  // par
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
    "score": 3,  // par
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

// Test Case 2: Player LOST with an ace (should return 0)
const test2_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // birdie
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

// Test Case 3: Player WON but no ace (should return 0)
const test3_opponents = [[
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

console.log("=".repeat(70));
console.log("TESTING: Win With Ace Function");
console.log("Badge: 'Vinn en match med ace'");
console.log("=".repeat(70));
console.log();

// Helper function to describe score relative to par
function getScoreDescription(score, par) {
    if (score === 1) return "ACE!";
    const diff = score - par;
    if (diff === -2) return "EAGLE";
    if (diff === -1) return "BIRDIE";
    if (diff === 0) return "PAR";
    if (diff === 1) return "BOGEY";
    if (diff === 2) return "DOUBLE";
    return `${diff > 0 ? '+' : ''}${diff}`;
}

// Helper function to find aces
function findAces(results) {
    return results.filter(r => r.score === 1);
}

// Test 1: Won with ace
console.log("TEST 1: Player WON with an ace");
console.log("-".repeat(70));
const result1 = winWithAceFunction(resultsWithAceWin, layout, test1_opponents);
const playerTotal1 = resultsWithAceWin.reduce((sum, r) => sum + r.score, 0);
const opponentTotal1 = test1_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces1 = findAces(resultsWithAceWin);
console.log("  Player Score breakdown:");
resultsWithAceWin.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Player Total: ${playerTotal1}`);
console.log(`  Player Aces: ${aces1.length} (on hole${aces1.length > 1 ? 's' : ''} ${aces1.map(a => a.holeNumber).join(', ')})`);
console.log(`  Opponent Total: ${opponentTotal1}`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (won with ace)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Lost with ace
console.log("TEST 2: Player LOST with an ace");
console.log("-".repeat(70));
const result2 = winWithAceFunction(resultsWithAceLoss, layout, test2_opponents);
const playerTotal2 = resultsWithAceLoss.reduce((sum, r) => sum + r.score, 0);
const opponentTotal2 = test2_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces2 = findAces(resultsWithAceLoss);
console.log("  Player Score breakdown:");
resultsWithAceLoss.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Player Total: ${playerTotal2}`);
console.log(`  Player Aces: ${aces2.length} (on hole${aces2.length > 1 ? 's' : ''} ${aces2.map(a => a.holeNumber).join(', ')})`);
console.log(`  Opponent Total: ${opponentTotal2}`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (lost, so badge not earned)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Won but no ace
console.log("TEST 3: Player WON but didn't get an ace");
console.log("-".repeat(70));
const result3 = winWithAceFunction(resultsNoAceWin, layout, test3_opponents);
const playerTotal3 = resultsNoAceWin.reduce((sum, r) => sum + r.score, 0);
const opponentTotal3 = test3_opponents.flat().reduce((sum, r) => sum + r.score, 0);
const aces3 = findAces(resultsNoAceWin);
console.log("  Player Score breakdown:");
resultsNoAceWin.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Player Total: ${playerTotal3}`);
console.log(`  Player Aces: ${aces3.length}`);
console.log(`  Opponent Total: ${opponentTotal3}`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (no ace, so badge not earned)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Won + Ace): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Lost + Ace): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Won + No Ace): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks for:");
    console.log("  1. Player must have gotten an ace (score === 1)");
    console.log("  2. Player must have won");
}

