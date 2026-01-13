// Function to check if player won after being at least 4 points behind the leader
// Badge: "Vinn en match efter att ha varit minst 4 poäng bakom ledaren"

const comebackWin4Function = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Flatten array of arrays if needed
    const flatResults = Array.isArray(allOtherPlayersResults[0]) && 
                       !allOtherPlayersResults[0].hasOwnProperty('playerId')
        ? allOtherPlayersResults.flat()
        : allOtherPlayersResults;
    
    // Calculate final totals
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
    
    // First check: Player must have won (lower score wins in golf)
    if (currentPlayerTotal >= bestOpponentTotal) {
        return 0;
    }
    
    // Second check: Player must have been at least 4 points behind at some point
    // Sort results by hole number to track progress
    const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
    
    let currentPlayerRunningTotal = 0;
    let wasBehindBy4 = false;
    
    for (let i = 0; i < sortedResults.length; i++) {
        currentPlayerRunningTotal += sortedResults[i].score;
        
        // Calculate opponent running totals up to this point
        const opponentRunningTotals = {};
        for (const otherResult of flatResults) {
            const playerId = String(otherResult.playerId);
            // Only count results up to the current hole
            const currentHoleNumber = sortedResults[i].holeNumber;
            if (otherResult.holeNumber <= currentHoleNumber) {
                if (!opponentRunningTotals[playerId]) {
                    opponentRunningTotals[playerId] = 0;
                }
                opponentRunningTotals[playerId] += otherResult.score;
            }
        }
        
        const bestOpponentRunningTotal = Math.min(...Object.values(opponentRunningTotals));
        const deficit = currentPlayerRunningTotal - bestOpponentRunningTotal;
        
        if (deficit >= 4) {
            wasBehindBy4 = true;
            break;
        }
    }
    
    return wasBehindBy4 ? 1 : 0;
};

// Test data - Player won after being 4 points behind
const resultsComeback4 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 5,  // Double bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 6,  // Double bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 2,  // Eagle (started comeback)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 1,  // Ace!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 2,  // Eagle
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Player won but was only 3 points behind (not 4)
const resultsWin3Behind = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,  // Par (opponent had birdie, so deficit is 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 2,  // Eagle
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 2,  // Eagle
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Player lost (even though was behind)
const resultsLost = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 5,  // Double bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 6,  // Double bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 3,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 4,  // Par
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

// Test Case 1: Player won after being 4 points behind
const test1_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 5,  // Bogey (worse than player's eagle)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 5,  // Bogey (worse than player's ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 5,  // Bogey (worse than player's eagle)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
]];

// Test Case 2: Player won but was only 3 points behind (not 4)
const test2_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 3,  // Par (same as player, so deficit stays at 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 5,  // Bogey (worse than player's eagle)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 5,  // Bogey (worse than player's birdie)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 5,  // Bogey (worse than player's eagle)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
]];

// Test Case 3: Player lost (even though was behind)
const test3_opponents = [[
  {
    "playerId": "opponent1",
    "holeNumber": 1,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 2,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 3,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 4,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 5,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "opponent1",
    "holeNumber": 6,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
]];

console.log("=".repeat(70));
console.log("TESTING: Comeback Win Function (4 Points Behind)");
console.log("Badge: 'Vinn en match efter att ha varit minst 4 poäng bakom ledaren'");
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

// Test 1: Won after being 4 points behind
console.log("TEST 1: Player WON after being 4 points behind");
console.log("-".repeat(70));
const result1 = comebackWin4Function(resultsComeback4, layout, test1_opponents);
const playerTotal1 = resultsComeback4.reduce((sum, r) => sum + r.score, 0);
const opponentTotal1 = test1_opponents.flat().reduce((sum, r) => sum + r.score, 0);
console.log("  Player Score breakdown:");
resultsComeback4.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Player Total: ${playerTotal1}`);
console.log(`  Opponent Total: ${opponentTotal1}`);
const playerAfter3 = resultsComeback4.slice(0, 3).reduce((s, r) => s + r.score, 0);
const opponentAfter3 = test1_opponents.flat().filter(r => r.holeNumber <= 3).reduce((s, r) => s + r.score, 0);
console.log(`  After hole 3: Player ${playerAfter3}, Opponent ${opponentAfter3} (deficit: ${playerAfter3 - opponentAfter3})`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (won after being 4+ points behind)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Won but was only 3 points behind (not 4)
console.log("TEST 2: Player WON but was only 3 points behind (not 4)");
console.log("-".repeat(70));
const result2 = comebackWin4Function(resultsWin3Behind, layout, test2_opponents);
const playerTotal2 = resultsWin3Behind.reduce((sum, r) => sum + r.score, 0);
const opponentTotal2 = test2_opponents.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`  Player Total: ${playerTotal2}`);
console.log(`  Opponent Total: ${opponentTotal2}`);
const playerAfter2 = resultsWin3Behind.slice(0, 2).reduce((s, r) => s + r.score, 0);
const opponentAfter2 = test2_opponents.flat().filter(r => r.holeNumber <= 2).reduce((s, r) => s + r.score, 0);
console.log(`  After hole 2: Player ${playerAfter2}, Opponent ${opponentAfter2} (deficit: ${playerAfter2 - opponentAfter2})`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (won but was only 3 points behind, not 4)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Lost (even though was behind)
console.log("TEST 3: Player LOST (even though was behind)");
console.log("-".repeat(70));
const result3 = comebackWin4Function(resultsLost, layout, test3_opponents);
const playerTotal3 = resultsLost.reduce((sum, r) => sum + r.score, 0);
const opponentTotal3 = test3_opponents.flat().reduce((sum, r) => sum + r.score, 0);
console.log(`  Player Total: ${playerTotal3}`);
console.log(`  Opponent Total: ${opponentTotal3}`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (lost, so badge not earned)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Won + Was 4+ behind): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Won + Only 3 behind): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Lost): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks for:");
    console.log("  1. Player must have won");
    console.log("  2. Player must have been at least 4 points behind the leader at some point");
}

