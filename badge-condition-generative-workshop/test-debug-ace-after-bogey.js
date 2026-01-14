// Debug version to find the error

const aceAfterBogeyFunction = (results, layout) => {
    if (!results || results.length < 2) {
        return 0;
    }
    
    for (let i = 0; i < results.length; i++) {
        const currentResult = results[i];
        
        const isAce = currentResult.score === 1;
        
        if (isAce) {
            const previousHoleNumber = currentResult.holeNumber - 1;
            const previousResult = results.find((r) => r.holeNumber === previousHoleNumber);

            console.log(i, previousHoleNumber);
            console.log(i, previousResult);
            
            if (previousResult) {
                const previousHole = layout.holes.find((h) => h.number === previousHoleNumber);
                const isBogey = previousHole && previousResult.score === previousHole.par + 1;
                
                // Fix: Check if previousHole exists before accessing .par
                console.log(previousResult.score, previousHole ? previousHole.par : 'N/A');
                console.log('isBogey', isBogey);

                if (isBogey) {
                    return 1;
                }
            } else {
                console.log('No previous result found for hole', previousHoleNumber);
            }
        }
    }
    
    return 0;
};

// Test with hole 1 having an ace (edge case)
const results = [
  {
    "playerId": "player1",
    "holeNumber": 1,
    "score": 1,  // ACE on first hole - no previous hole!
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:00:00.000Z"
  },
  {
    "playerId": "player1",
    "holeNumber": 2,
    "score": 4,
    "putt": "inside",
    "obCount": 0,
    "specifics": {},
    "timestamp": "2025-01-15T10:05:00.000Z"
  }
];

const layout = {
  "holes": [
    { "number": 1, "par": 3 },
    { "number": 2, "par": 4 }
  ]
};

console.log("Testing edge case: Ace on hole 1");
console.log("=".repeat(70));
const result = aceAfterBogeyFunction(results, layout);
console.log(`Result: ${result}`);

