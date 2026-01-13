// Function to check for 3 consecutive birdie-to-bogey or bogey-to-birdie transitions
// Pattern 1: Bogey → Birdie → Bogey → Birdie → Bogey → Birdie (3 bogey-to-birdie transitions)
// Pattern 2: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey (3 birdie-to-bogey transitions)
// Requires 6 consecutive holes

const birdieBogey3TransitionsFunction = (results, layout) => {
    if (!results || results.length < 6) {
        return 0;
    }
    
    // Sort results by hole number to ensure correct order
    const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
    
    // Check for 3 consecutive transitions in 6 consecutive holes
    for (let i = 0; i <= sortedResults.length - 6; i++) {
        const sequence = sortedResults.slice(i, i + 6);
        
        // Check pattern: Bogey → Birdie → Bogey → Birdie → Bogey → Birdie
        // (3 bogey-to-birdie transitions)
        let pattern1Valid = true;
        for (let j = 0; j < 6; j++) {
            const result = sequence[j];
            const hole = layout.holes.find((h) => h.number === result.holeNumber);
            if (!hole) {
                pattern1Valid = false;
                break;
            }
            
            const expectedScore = j % 2 === 0 
                ? hole.par + 1  // Bogey (even indices: 0, 2, 4)
                : hole.par - 1;  // Birdie (odd indices: 1, 3, 5)
            
            if (result.score !== expectedScore) {
                pattern1Valid = false;
                break;
            }
        }
        
        // Check pattern: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey
        // (3 birdie-to-bogey transitions)
        let pattern2Valid = true;
        for (let j = 0; j < 6; j++) {
            const result = sequence[j];
            const hole = layout.holes.find((h) => h.number === result.holeNumber);
            if (!hole) {
                pattern2Valid = false;
                break;
            }
            
            const expectedScore = j % 2 === 0 
                ? hole.par - 1  // Birdie (even indices: 0, 2, 4)
                : hole.par + 1;  // Bogey (odd indices: 1, 3, 5)
            
            if (result.score !== expectedScore) {
                pattern2Valid = false;
                break;
            }
        }
        
        if (pattern1Valid || pattern2Valid) {
            return 1;
        }
    }
    
    return 0;
};

// Test data - Pattern 1: Bogey → Birdie → Bogey → Birdie → Bogey → Birdie
const resultsPattern1 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 4,  // Bogey (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,  // Birdie (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 4,  // Bogey (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 3,  // Birdie (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 4,  // Bogey (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 3,  // Birdie (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

// Test data - Pattern 2: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey
const resultsPattern2 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Birdie (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 5,  // Bogey (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 2,  // Birdie (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 4,
    "score": 5,  // Bogey (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 5,
    "score": 2,  // Birdie (par 3)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 6,
    "score": 5,  // Bogey (par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  }
];

// Test data - Pattern broken (has a par in between)
const resultsBrokenPattern = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Birdie
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:16.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 5,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 3,
    "score": 3,  // PAR (breaks pattern)
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
    "score": 2,  // Birdie
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

// Test data - Pattern starts later in round
const resultsPatternLater = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,  // Par
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
    "score": 4,  // Bogey (start of pattern)
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
    "score": 4,  // Bogey
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
  },
  {
    "playerId": "player1",
    "holeNumber": 7,
    "score": 4,  // Bogey
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:15:20.467Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 8,
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

// Helper function to describe score relative to par
function getScoreDescription(score, par) {
    const diff = score - par;
    if (diff === -2) return "EAGLE";
    if (diff === -1) return "BIRDIE";
    if (diff === 0) return "PAR";
    if (diff === 1) return "BOGEY";
    if (diff === 2) return "DOUBLE";
    return `${diff > 0 ? '+' : ''}${diff}`;
}

console.log("=".repeat(70));
console.log("TESTING: 3 Consecutive Birdie-Bogey Transitions");
console.log("Pattern 1: Bogey → Birdie → Bogey → Birdie → Bogey → Birdie");
console.log("Pattern 2: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey");
console.log("=".repeat(70));
console.log();

// Test 1: Pattern 1 - Bogey-Birdie-Bogey-Birdie-Bogey-Birdie
console.log("TEST 1: Pattern Bogey → Birdie → Bogey → Birdie → Bogey → Birdie");
console.log("        (3 bogey-to-birdie transitions)");
console.log("-".repeat(70));
const result1 = birdieBogey3TransitionsFunction(resultsPattern1, layout);
console.log("  Score breakdown:");
resultsPattern1.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result1} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 1 (3 consecutive bogey-to-birdie transitions)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Pattern 2 - Birdie-Bogey-Birdie-Bogey-Birdie-Bogey
console.log("TEST 2: Pattern Birdie → Bogey → Birdie → Bogey → Birdie → Bogey");
console.log("        (3 birdie-to-bogey transitions)");
console.log("-".repeat(70));
const result2 = birdieBogey3TransitionsFunction(resultsPattern2, layout);
console.log("  Score breakdown:");
resultsPattern2.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result2} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 1 (3 consecutive birdie-to-bogey transitions)`);
console.log(`  Test: ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Broken pattern (has par in between)
console.log("TEST 3: Pattern broken (has par in between)");
console.log("-".repeat(70));
const result3 = birdieBogey3TransitionsFunction(resultsBrokenPattern, layout);
console.log("  Score breakdown:");
resultsBrokenPattern.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result3} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 0 (pattern broken by par)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Pattern starts later
console.log("TEST 4: Pattern starts later in round");
console.log("-".repeat(70));
const result4 = birdieBogey3TransitionsFunction(resultsPatternLater, layout);
console.log("  Score breakdown:");
resultsPatternLater.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result4} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 1 (pattern found starting at hole 3)`);
console.log(`  Test: ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 5: Not enough holes
console.log("TEST 5: Not enough holes (< 6)");
console.log("-".repeat(70));
const result5 = birdieBogey3TransitionsFunction(resultsPattern1.slice(0, 5), layout);
console.log(`  Holes: ${resultsPattern1.slice(0, 5).length}`);
console.log(`  Result: ${result5} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 0 (need at least 6 holes)`);
console.log(`  Test: ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Bogey-Birdie pattern): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Birdie-Bogey pattern): ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Broken pattern): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (Pattern later): ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (Not enough holes): ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 1 && result3 === 0 && result4 === 1 && result5 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly finds 3 consecutive transitions:");
    console.log("  - Bogey → Birdie → Bogey → Birdie → Bogey → Birdie");
    console.log("  - Birdie → Bogey → Birdie → Bogey → Birdie → Bogey");
    console.log("  Requires 6 consecutive holes without gaps");
}

