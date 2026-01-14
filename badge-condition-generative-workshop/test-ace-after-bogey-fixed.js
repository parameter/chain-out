// Function to check if player made an ace immediately after a bogey
// Finds previous hole by holeNumber instead of array position

const aceAfterBogeyFunction = (results, layout) => {
    if (!results || results.length < 2) {
        return 0;
    }

    console.log(results);
    console.log('check 1');
    
    for (let i = 0; i < results.length; i++) {
        const currentResult = results[i];
        
        const isAce = currentResult.score === 1;
        
        if (isAce) {
            console.log('check 2');
            // Find the previous hole's result by holeNumber (current hole - 1)
            const previousHoleNumber = currentResult.holeNumber - 1;
            const previousResult = results.find((r) => r.holeNumber === previousHoleNumber);
            
            if (previousResult) {
                // Find the hole definition for the previous hole
                const previousHole = layout.holes.find((h) => h.number === previousHoleNumber);
                const isBogey = previousHole && previousResult.score === previousHole.par + 1;
                
                console.log(`  Current hole: ${currentResult.holeNumber}, Previous hole: ${previousHoleNumber}`);
                console.log(`  Previous result found: ${!!previousResult}, Previous hole found: ${!!previousHole}`);
                console.log(`  Previous score: ${previousResult.score}, Previous par: ${previousHole ? previousHole.par : 'N/A'}`);
                console.log(`  Is bogey: ${isBogey}`);
                
                // If previous hole was a bogey, return 1
                if (isBogey) {
                    return 1;
                }
            } else {
                console.log(`  No previous result found for hole ${previousHoleNumber}`);
            }
        }
    }

    console.log('check 3');
    
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
console.log("TESTING: Ace After Bogey Function (Fixed - finds by holeNumber)");
console.log("=".repeat(70));
console.log();

const result = aceAfterBogeyFunction(results, layout);
console.log();
console.log(`Result: ${result}`);
console.log(`Expected: 1`);
console.log(`Test: ${result === 1 ? 'PASS ✓' : 'FAIL ✗'}`);

