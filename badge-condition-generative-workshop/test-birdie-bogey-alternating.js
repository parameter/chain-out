// Function to check if player alternates between birdie and bogey 3 times consecutively
// Pattern: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey (or vice versa)
// Need at least 4 holes: Birdie-Bogey-Birdie-Bogey (3 transitions)

const birdieBogeyAlternatingFunction = (results, layout) => {
    if (!results || results.length < 4) {
        return 0;
    }
    
    // Sort results by hole number to ensure correct order
    const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
    
    // Check for alternating pattern: Birdie-Bogey-Birdie-Bogey (or Bogey-Birdie-Bogey-Birdie)
    // We need at least 4 consecutive holes with 3 transitions
    
    for (let i = 0; i <= sortedResults.length - 4; i++) {
        const sequence = sortedResults.slice(i, i + 4);
        
        // Check if this sequence has alternating birdie-bogey pattern
        let isValidPattern = true;
        
        // Check pattern: Birdie → Bogey → Birdie → Bogey
        let pattern1Valid = true;
        for (let j = 0; j < 4; j++) {
            const result = sequence[j];
            const hole = layout.holes.find((h) => h.number === result.holeNumber);
            if (!hole) {
                pattern1Valid = false;
                break;
            }
            
            const expectedScore = j % 2 === 0 
                ? hole.par - 1  // Birdie (even indices: 0, 2)
                : hole.par + 1;  // Bogey (odd indices: 1, 3)
            
            if (result.score !== expectedScore) {
                pattern1Valid = false;
                break;
            }
        }
        
        // Check pattern: Bogey → Birdie → Bogey → Birdie
        let pattern2Valid = true;
        for (let j = 0; j < 4; j++) {
            const result = sequence[j];
            const hole = layout.holes.find((h) => h.number === result.holeNumber);
            if (!hole) {
                pattern2Valid = false;
                break;
            }
            
            const expectedScore = j % 2 === 0 
                ? hole.par + 1  // Bogey (even indices: 0, 2)
                : hole.par - 1;  // Birdie (odd indices: 1, 3)
            
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

// Test data - Pattern: Birdie → Bogey → Birdie → Bogey → Birdie → Bogey
const resultsPattern1 = [
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

// Test data - Pattern: Bogey → Birdie → Bogey → Birdie → Bogey → Birdie
const resultsPattern2 = [
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

// Test data - No alternating pattern
const resultsNoPattern = [
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
    "score": 3,  // Birdie (not bogey)
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
    "score": 3,  // Par (not birdie or bogey)
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
    "score": 2,  // Birdie (start of pattern)
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
console.log("TESTING: Birdie-Bogey Alternating Pattern (3 times)");
console.log("=".repeat(70));
console.log();

// Test 1: Pattern Birdie-Bogey-Birdie-Bogey-Birdie-Bogey
console.log("TEST 1: Pattern Birdie → Bogey → Birdie → Bogey → Birdie → Bogey");
console.log("-".repeat(70));
const result1 = birdieBogeyAlternatingFunction(resultsPattern1, layout);
console.log("  Score breakdown:");
resultsPattern1.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result1} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 1 (pattern found)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Pattern Bogey-Birdie-Bogey-Birdie-Bogey-Birdie
console.log("TEST 2: Pattern Bogey → Birdie → Bogey → Birdie → Bogey → Birdie");
console.log("-".repeat(70));
const result2 = birdieBogeyAlternatingFunction(resultsPattern2, layout);
console.log("  Score breakdown:");
resultsPattern2.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result2} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 1 (pattern found)`);
console.log(`  Test: ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: No pattern
console.log("TEST 3: No alternating pattern");
console.log("-".repeat(70));
const result3 = birdieBogeyAlternatingFunction(resultsNoPattern, layout);
console.log("  Score breakdown:");
resultsNoPattern.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const desc = hole ? getScoreDescription(r.score, hole.par) : '';
    console.log(`    Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});
console.log(`  Result: ${result3} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 0 (no pattern)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Pattern starts later
console.log("TEST 4: Pattern starts later in round");
console.log("-".repeat(70));
const result4 = birdieBogeyAlternatingFunction(resultsPatternLater, layout);
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
console.log("TEST 5: Not enough holes (< 4)");
console.log("-".repeat(70));
const result5 = birdieBogeyAlternatingFunction(resultsPattern1.slice(0, 3), layout);
console.log(`  Holes: ${resultsPattern1.slice(0, 3).length}`);
console.log(`  Result: ${result5} (1 = pattern found, 0 = not found)`);
console.log(`  Expected: 0 (need at least 4 holes)`);
console.log(`  Test: ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Birdie-Bogey pattern): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Bogey-Birdie pattern): ${result2 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (No pattern): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (Pattern later): ${result4 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 5 (Not enough holes): ${result5 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 1 && result3 === 0 && result4 === 1 && result5 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly finds alternating birdie-bogey pattern");
    console.log("  requiring at least 4 consecutive holes (3 transitions)");
}

