// Fixed version - handles undefined previousHole

(results, layout) => {
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
            }
        }
    }
    
    return 0;
}

