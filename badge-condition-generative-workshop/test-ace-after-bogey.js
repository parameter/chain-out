// Function to check if player made an ace immediately after a bogey
// Badge: "Gör ett ace direkt efter en bogey" (Make an ace straight after any bogey)

const aceAfterBogeyFunction = (results, layout) => {
    if (!results || results.length < 2) {
        return 0;
    }
    
    // Sort results by hole number to ensure correct order
    const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
    
    // Check each consecutive pair of holes
    for (let i = 0; i < sortedResults.length - 1; i++) {
        const currentResult = sortedResults[i];
        const nextResult = sortedResults[i + 1];
        
        // Check if current hole is a bogey
        const currentHole = layout.holes.find((h) => h.number === currentResult.holeNumber);
        const isBogey = currentHole && currentResult.score === currentHole.par + 1;
        
        // Check if next hole is an ace
        const isAce = nextResult.score === 1;
        
        // If we found bogey followed by ace, return 1
        if (isBogey && isAce) {
            return 1;
        }
    }
    
    return 0;
};

// Test data - Ace after bogey (pattern found)
const resultsAceAfterBogey = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,  // Par
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 5,  // Bogey (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 1,  // ACE! (after bogey)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 4,  // Bogey (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:20:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 1,  // ACE! (after bogey)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:25:00.000Z"
  }
];

// Test data - Bogey after ace (wrong order)
const resultsBogeyAfterAce = [
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
    "score": 5,  // Bogey (par 4) - wrong order
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  }
];

// Test data - Ace and bogey but not consecutive
const resultsNotConsecutive = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 4,  // Bogey (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,  // Par (not ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 1,  // ACE! (but not after bogey)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  }
];

// Test data - Multiple bogeys but no ace after
const resultsNoAceAfterBogey = [
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
    "score": 3,  // Par (not ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 5,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:10:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 2,  // Birdie (not ace)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:00.000Z"
  }
];

// Test data - Results not in order
const resultsUnsorted = [
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
    "holeNumber": 1,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 5,  // Bogey (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
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

console.log("=".repeat(70));
console.log("TESTING: Ace After Bogey Function");
console.log("Badge: 'Gör ett ace direkt efter en bogey'");
console.log("=".repeat(70));
console.log();

// Test 1: Ace after bogey (pattern found)
console.log("TEST 1: Ace after bogey (pattern found)");
console.log("-".repeat(70));
const result1 = aceAfterBogeyFunction(resultsAceAfterBogey, layout);
console.log("  Score breakdown:");
resultsAceAfterBogey.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    const marker = (r.score === 1 && resultsAceAfterBogey.find(prev => prev.holeNumber === r.holeNumber - 1 && prev.score === (layout.holes.find(h => h.number === r.holeNumber - 1)?.par || 0) + 1)) ? " ⭐" : "";
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})${marker}`);
});
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (ace after bogey found)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Bogey after ace (wrong order)
console.log("TEST 2: Bogey after ace (wrong order)");
console.log("-".repeat(70));
const result2 = aceAfterBogeyFunction(resultsBogeyAfterAce, layout);
console.log("  Score breakdown:");
resultsBogeyAfterAce.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (wrong order - ace before bogey)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Ace and bogey but not consecutive
console.log("TEST 3: Ace and bogey but not consecutive");
console.log("-".repeat(70));
const result3 = aceAfterBogeyFunction(resultsNotConsecutive, layout);
console.log("  Score breakdown:");
resultsNotConsecutive.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (ace not immediately after bogey)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Multiple bogeys but no ace after
console.log("TEST 4: Multiple bogeys but no ace after");
console.log("-".repeat(70));
const result4 = aceAfterBogeyFunction(resultsNoAceAfterBogey, layout);
console.log("  Score breakdown:");
resultsNoAceAfterBogey.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result4} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (no ace after any bogey)`);
console.log(`  Test: ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 5: Results not in order (should still work)
console.log("TEST 5: Results not in chronological order (should still work)");
console.log("-".repeat(70));
const result5 = aceAfterBogeyFunction(resultsUnsorted, layout);
console.log("  Score breakdown (sorted by hole number):");
const sorted5 = [...resultsUnsorted].sort((a, b) => a.holeNumber - b.holeNumber);
sorted5.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result5} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (ace after bogey found, even if unsorted)`);
console.log(`  Test: ${result5 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 6: Not enough holes
console.log("TEST 6: Not enough holes (< 2)");
console.log("-".repeat(70));
const result6 = aceAfterBogeyFunction([resultsAceAfterBogey[0]], layout);
console.log(`  Holes: 1`);
console.log(`  Result: ${result6} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (need at least 2 holes)`);
console.log(`  Test: ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Ace after bogey): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Bogey after ace): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Not consecutive): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (No ace after bogey): ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (Unsorted): ${result5 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 6 (Not enough holes): ${result6 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0 && result4 === 0 && result5 === 1 && result6 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Player must have made an ace (score === 1)");
    console.log("  2. Ace must be immediately after a bogey (score === par + 1)");
    console.log("  3. Works even if results are not in chronological order");
}

