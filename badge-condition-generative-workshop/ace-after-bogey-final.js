// Function to check if player made an ace immediately after a bogey
// Badge: "Gör ett ace direkt efter en bogey" (Make an ace straight after any bogey)

(results, layout) => {
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
            
            // If previous hole was a bogey, return 1
            if (isBogey) {
                return 1;
            }
        }
    }
    
    return 0;
}

