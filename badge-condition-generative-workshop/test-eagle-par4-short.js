// Function to check if player made an eagle on a par 4 less than 150m
// Badge: "Gör ett eagle på en par 4 kortare än 150m"

const eaglePar4ShortFunction = (results, layout) => {
    // Return 1 if the player made at least one eagle on a par 4 hole less than 150m, otherwise 0
    const hasPar4EagleShort = results.some((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        
        // Check if it's a par 4
        if (!hole || hole.par !== 4) {
            return false;
        }
        
        // Check if it's an eagle (score === par - 2, so score === 2 for par 4)
        if (r.score !== hole.par - 2) {
            return false;
        }
        
        // Check if hole length is less than 150m
        // Assuming length is in meters (or check measureInMeters flag)
        const lengthInMeters = hole.measureInMeters ? hole.length : (hole.length || 0);
        
        return lengthInMeters > 0 && lengthInMeters < 150;
    });
    
    return hasPar4EagleShort ? 1 : 0;
};

// Test data - Eagle on par 4 that is 120m
const results1 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Eagle on par 4
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 3,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  }
];

// Test data - Eagle on par 4 that is 200m (too long)
const results2 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 2,  // Eagle on par 4
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  }
];

// Test data - Birdie on par 4 that is 120m (not eagle)
const results3 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 3,  // Birdie on par 4 (not eagle)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  }
];

// Test data - Eagle on par 3 (not par 4)
const results4 = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // Eagle on par 3 (not par 4)
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  }
];

const layout1 = {
  "holes": [
    {
      "number": 1,
      "par": 4,
      "length": 120,
      "measureInMeters": true
    },
    {
      "number": 2,
      "par": 3,
      "length": 100,
      "measureInMeters": true
    }
  ]
};

const layout2 = {
  "holes": [
    {
      "number": 1,
      "par": 4,
      "length": 200,
      "measureInMeters": true
    }
  ]
};

const layout3 = {
  "holes": [
    {
      "number": 1,
      "par": 4,
      "length": 120,
      "measureInMeters": true
    }
  ]
};

const layout4 = {
  "holes": [
    {
      "number": 1,
      "par": 3,
      "length": 100,
      "measureInMeters": true
    }
  ]
};

console.log("=".repeat(70));
console.log("TESTING: Eagle on Par 4 Less Than 150m");
console.log("=".repeat(70));
console.log();

// Test 1: Eagle on par 4 that is 120m (< 150m)
console.log("TEST 1: Eagle on par 4 that is 120m (< 150m)");
console.log("-".repeat(70));
const result1 = eaglePar4ShortFunction(results1, layout1);
console.log(`  Hole 1: score ${results1[0].score}, par ${layout1.holes[0].par}, length ${layout1.holes[0].length}m`);
console.log(`  Result: ${result1} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 1 (eagle on par 4 < 150m)`);
console.log(`  Test: ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 2: Eagle on par 4 that is 200m (>= 150m)
console.log("TEST 2: Eagle on par 4 that is 200m (>= 150m)");
console.log("-".repeat(70));
const result2 = eaglePar4ShortFunction(results2, layout2);
console.log(`  Hole 1: score ${results2[0].score}, par ${layout2.holes[0].par}, length ${layout2.holes[0].length}m`);
console.log(`  Result: ${result2} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (eagle on par 4 but >= 150m)`);
console.log(`  Test: ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 3: Birdie on par 4 that is 120m (not eagle)
console.log("TEST 3: Birdie on par 4 that is 120m (not eagle)");
console.log("-".repeat(70));
const result3 = eaglePar4ShortFunction(results3, layout3);
console.log(`  Hole 1: score ${results3[0].score}, par ${layout3.holes[0].par}, length ${layout3.holes[0].length}m`);
console.log(`  Result: ${result3} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (not an eagle)`);
console.log(`  Test: ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

// Test 4: Eagle on par 3 (not par 4)
console.log("TEST 4: Eagle on par 3 (not par 4)");
console.log("-".repeat(70));
const result4 = eaglePar4ShortFunction(results4, layout4);
console.log(`  Hole 1: score ${results4[0].score}, par ${layout4.holes[0].par}, length ${layout4.holes[0].length}m`);
console.log(`  Result: ${result4} (1 = badge earned, 0 = not earned)`);
console.log(`  Expected: 0 (not a par 4)`);
console.log(`  Test: ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

console.log("=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log(`Test 1 (Eagle on par 4 < 150m): ${result1 === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (Eagle on par 4 >= 150m): ${result2 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (Birdie on par 4 < 150m): ${result3 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 4 (Eagle on par 3): ${result4 === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log();

if (result1 === 1 && result2 === 0 && result3 === 0 && result4 === 0) {
    console.log("✓ ALL TESTS PASSED!");
    console.log("  The function correctly checks:");
    console.log("  1. Hole must be par 4");
    console.log("  2. Score must be eagle (par - 2, so score === 2)");
    console.log("  3. Hole length must be less than 150m");
}

