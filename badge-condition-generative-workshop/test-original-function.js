// Test the ORIGINAL function as provided by user (without .flat() fix)

const originalFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    const opponentTotals = {};
    for (const otherResult of allOtherPlayersResults) {
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

// User's original data structure (array of arrays)
const allOtherPlayersResults = [
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

console.log("=== Testing ORIGINAL Function (as provided) ===\n");
console.log("Data structure issue:");
console.log("allOtherPlayersResults is an array of arrays:");
console.log(`  Type: ${Array.isArray(allOtherPlayersResults)}`);
console.log(`  Length: ${allOtherPlayersResults.length}`);
console.log(`  First element type: ${Array.isArray(allOtherPlayersResults[0])}`);
console.log(`  First element length: ${allOtherPlayersResults[0].length}\n`);

console.log("The original function will iterate over the outer array,");
console.log("treating each inner array as a single result object.\n");

try {
    const result = originalFunction(results, layout, allOtherPlayersResults);
    console.log(`Function result: ${result}`);
    console.log("\n⚠️  ISSUE: The function tries to access .playerId and .score");
    console.log("   on an array, which will cause errors or incorrect behavior.\n");
} catch (error) {
    console.log(`❌ ERROR: ${error.message}\n`);
}

console.log("=== CORRECTED VERSION ===");
console.log("The function should flatten the array first:\n");

const correctedFunction = (results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Flatten array of arrays to handle nested structure
    const flatResults = Array.isArray(allOtherPlayersResults[0]) 
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

const correctedResult = correctedFunction(results, layout, allOtherPlayersResults);
console.log(`Corrected function result: ${correctedResult}`);
console.log(`Player score: ${results.reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Opponent score: ${allOtherPlayersResults.flat().reduce((sum, r) => sum + r.score, 0)}`);
console.log(`Result: ${correctedResult === 1 ? 'WON' : 'LOST/TIE'}`);

