// Test with user's exact data

const aceAfterBogeyFunction = (results, layout) => {
    if (!results || results.length < 2) {
        return 0;
    }
    
    // Sort results by hole number to ensure correct order
    const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
    
    // Check each hole starting from the second one (so we can check the previous hole)
    for (let i = 1; i < sortedResults.length; i++) {
        const currentResult = sortedResults[i];
        const previousResult = sortedResults[i - 1];
        
        // Check if current hole is an ace
        const isAce = currentResult.score === 1;
        
        // If current hole is an ace, check if previous hole was a bogey
        if (isAce) {
            const previousHole = layout.holes.find((h) => h.number === previousResult.holeNumber);
            const isBogey = previousHole && previousResult.score === previousHole.par + 1;
            
            console.log(`  Checking hole ${currentResult.holeNumber}:`);
            console.log(`    Current hole: ${currentResult.holeNumber}, score: ${currentResult.score} (isAce: ${isAce})`);
            console.log(`    Previous hole: ${previousResult.holeNumber}, score: ${previousResult.score}`);
            console.log(`    Previous hole par: ${previousHole ? previousHole.par : 'not found'}`);
            console.log(`    Is bogey: ${isBogey} (score ${previousResult.score} === par ${previousHole ? previousHole.par : '?'} + 1)`);
            
            // If previous hole was a bogey, return 1
            if (isBogey) {
                return 1;
            }
        }
    }
    
    return 0;
};

// User's exact test data
const results = [
  {
    "playerId": "68da392e41254148ddea8883",
    "holeNumber": 1,
    "score": 4,
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
    "score": 1,
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

console.log("=".repeat(70));
console.log("TESTING with User's Exact Data");
console.log("=".repeat(70));
console.log();

console.log("Score breakdown:");
results.forEach(r => {
    const hole = layout.holes.find(h => h.number === r.holeNumber);
    const par = hole ? hole.par : '?';
    const diff = hole ? r.score - hole.par : 0;
    let desc = '';
    if (r.score === 1) desc = 'ACE!';
    else if (diff === -2) desc = 'EAGLE';
    else if (diff === -1) desc = 'BIRDIE';
    else if (diff === 0) desc = 'PAR';
    else if (diff === 1) desc = 'BOGEY';
    else if (diff === 2) desc = 'DOUBLE';
    else desc = `${diff > 0 ? '+' : ''}${diff}`;
    console.log(`  Hole ${r.holeNumber}: ${r.score} (par ${par}, ${desc})`);
});

console.log();
console.log("Expected:");
console.log("  Hole 1: score 4, par 3 → BOGEY (4 = 3 + 1)");
console.log("  Hole 2: score 1 → ACE!");
console.log("  Should return 1 (ace after bogey)");
console.log();

const result = aceAfterBogeyFunction(results, layout);
console.log();
console.log(`Result: ${result}`);
console.log(`Expected: 1`);
console.log(`Test: ${result === 1 ? 'PASS ✓' : 'FAIL ✗'}`);

