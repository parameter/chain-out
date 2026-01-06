const fs = require('fs');
const path = require('path');

// Load badge definitions
const badgeDefinitionsPath = path.join(__dirname, 'badgeDefinitions.json');
const badges = JSON.parse(fs.readFileSync(badgeDefinitionsPath, 'utf8'));

// Get all done badges for pattern reference
const doneBadges = badges.filter(b => b.done === true);
const undoneBadges = badges.filter(b => b.done === false || b.done === undefined);

console.log(`Total badges: ${badges.length}`);
console.log(`Done badges: ${doneBadges.length}`);
console.log(`Undone badges: ${undoneBadges.length}\n`);

// Function to generate condition based on functional description
function generateCondition(badge) {
    const funcDesc = badge.functionalDescription || '';
    const name = badge.name || '';
    const id = badge.id || '';
    
    // Check if it uses allOtherPlayersResults (multiplayer badges)
    const isMultiplayer = funcDesc.toLowerCase().includes('vunnit') || 
                         funcDesc.toLowerCase().includes('win') ||
                         funcDesc.toLowerCase().includes('match') ||
                         funcDesc.toLowerCase().includes('dubbel') ||
                         funcDesc.toLowerCase().includes('doubles') ||
                         id.includes('dominating') ||
                         id.includes('ride_or_die') ||
                         id.includes('separation');
    
    // Pattern matching based on functional description
    const descLower = funcDesc.toLowerCase();
    
    // Birdie patterns
    if (descLower.includes('birdie') || descLower.includes('birdies')) {
        if (descLower.includes('rad') || descLower.includes('consecutive') || descLower.includes('i rad')) {
            // Consecutive birdies
            return `(results, layout) => {
    if (results.length === 0) {
        return 0;
    }
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const hole = layout.holes.find((h) => h.holeNumber === result.holeNumber);
        
        if (hole && result.score === hole.par - 1) {
            currentStreak++;
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    }
    
    return longestStreak;
}`;
        } else if (descLower.includes('total') || descLower.includes('totalt') || descLower.includes('antal')) {
            // Total birdies
            return `(results, layout) => {
    const birdies = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par - 1;
    }).length;
    return birdies || 0;
}`;
        }
    }
    
    // Par patterns
    if (descLower.includes('par') && !descLower.includes('bogey') && !descLower.includes('under par') && !descLower.includes('över par')) {
        if (descLower.includes('rad') || descLower.includes('consecutive') || descLower.includes('i rad')) {
            // Consecutive pars
            return `(results, layout) => {
    if (results.length === 0) {
        return 0;
    }
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const hole = layout.holes.find((h) => h.holeNumber === result.holeNumber);
        
        if (hole && result.score === hole.par) {
            currentStreak++;
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    }
    
    return longestStreak;
}`;
        } else if (descLower.includes('total') || descLower.includes('totalt') || descLower.includes('antal')) {
            // Total pars
            return `(results, layout) => {
    const pars = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par;
    }).length;
    return pars || 0;
}`;
        }
    }
    
    // Bogey patterns
    if (descLower.includes('bogey') || descLower.includes('bogeys')) {
        if (descLower.includes('rad') || descLower.includes('consecutive') || descLower.includes('i rad')) {
            // Consecutive bogeys
            return `(results, layout) => {
    if (results.length === 0) {
        return 0;
    }
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const hole = layout.holes.find((h) => h.holeNumber === result.holeNumber);
        
        if (hole && result.score === hole.par + 1) {
            currentStreak++;
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    }
    
    return longestStreak;
}`;
        } else if (descLower.includes('total') || descLower.includes('totalt') || descLower.includes('antal')) {
            // Total bogeys
            return `(results, layout) => {
    const bogeys = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par + 1;
    }).length;
    return bogeys || 0;
}`;
        }
    }
    
    // Eagle patterns
    if (descLower.includes('eagle') || descLower.includes('eagles')) {
        return `(results, layout) => {
    const eagles = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par - 2;
    }).length;
    return eagles || 0;
}`;
    }
    
    // Ace patterns
    if (descLower.includes('ace') || descLower.includes('aces') || descLower.includes('hål i ett')) {
        if (descLower.includes('olika banor') || descLower.includes('different courses')) {
            // Aces on different courses
            return `(results, layout) => {
    return results.find((res) => res.score === 1) ? 1 : 0;
}`;
        } else {
            // Total aces
            return `(results, layout) => {
    const aces = results.filter((r) => {
        return r.score === 1;
    }).length;
    return aces || 0;
}`;
        }
    }
    
    // OB patterns
    if (descLower.includes('ob') || descLower.includes('out of bounds')) {
        return `(results, layout) => {
    let nr_obs = 0;
    results.forEach((r) => {
        nr_obs = nr_obs + (r.obCount || 0);
    });
    return nr_obs || 0;
}`;
    }
    
    // Circle patterns (C1, C2)
    if (descLower.includes('cirkel 1') || descLower.includes('circle 1') || descLower.includes('c1')) {
        if (descLower.includes('rad') || descLower.includes('consecutive') || descLower.includes('i rad')) {
            // Consecutive C1
            return `(results, layout) => {
    if (results.length === 0) {
        return 0;
    }
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        if (result.specifics && result.specifics.c1 === true) {
            currentStreak++;
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    }
    
    return longestStreak;
}`;
        } else {
            // Total C1
            return `(results, layout) => {
    return results.filter((r) => {
        return r.specifics && r.specifics.c1 === true;
    }).length;
}`;
        }
    }
    
    if (descLower.includes('cirkel 2') || descLower.includes('circle 2') || descLower.includes('c2')) {
        if (descLower.includes('rad') || descLower.includes('consecutive') || descLower.includes('i rad')) {
            // Consecutive C2
            return `(results, layout) => {
    if (results.length === 0) {
        return 0;
    }
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        if (result.specifics && result.specifics.c2 === true) {
            currentStreak++;
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        } else {
            currentStreak = 0;
        }
    }
    
    return longestStreak;
}`;
        } else {
            // Total C2
            return `(results, layout) => {
    return results.filter((r) => {
        return r.specifics && r.specifics.c2 === true;
    }).length;
}`;
        }
    }
    
    // Bullseye patterns
    if (descLower.includes('bullseye')) {
        return `(results, layout) => {
    const bullseye = results.filter((r) => {
        return r.specifics && r.specifics.bullseye === true;
    }).length;
    return bullseye || 0;
}`;
    }
    
    // Putt patterns
    if (descLower.includes('putt') || descLower.includes('puttar')) {
        if (descLower.includes('inside')) {
            return `(results, layout) => {
    return results.filter((r) => {
        return r.putt === 'inside';
    }).length;
}`;
        } else if (descLower.includes('outside')) {
            return `(results, layout) => {
    return results.filter((r) => {
        return r.putt === 'outside';
    }).length;
}`;
        } else {
            return `(results, layout) => {
    return results.filter((r) => {
        return r.putt === 'inside' || r.putt === 'outside';
    }).length;
}`;
        }
    }
    
    // Round patterns
    if (descLower.includes('runda') || descLower.includes('round') || descLower.includes('rundor')) {
        if (descLower.includes('under par') || descLower.includes('below par')) {
            // Round under par
            return `(results, layout) => {
    if (!results || results.length === 0 || !layout || !layout.holes) {
        return 0;
    }
    
    if (results.length !== layout.holes.length) {
        return 0;
    }
    
    const holeNumbersInLayout = new Set(layout.holes.map(h => h.holeNumber));
    const holeNumbersInResults = new Set(results.map(r => r.holeNumber));
    
    if (holeNumbersInLayout.size !== holeNumbersInResults.size) {
        return 0;
    }
    
    let totalScore = 0;
    let totalPar = 0;
    
    for (const result of results) {
        const hole = layout.holes.find((h) => h.holeNumber === result.holeNumber);
        if (hole) {
            totalScore += result.score;
            totalPar += hole.par;
        }
    }
    
    return totalScore < totalPar ? 1 : 0;
}`;
        } else if (descLower.includes('över par') || descLower.includes('over par')) {
            // Round over par
            return `(results, layout) => {
    if (!results || results.length === 0 || !layout || !layout.holes) {
        return 0;
    }
    
    if (results.length !== layout.holes.length) {
        return 0;
    }
    
    const holeNumbersInLayout = new Set(layout.holes.map(h => h.holeNumber));
    const holeNumbersInResults = new Set(results.map(r => r.holeNumber));
    
    if (holeNumbersInLayout.size !== holeNumbersInResults.size) {
        return 0;
    }
    
    let totalScore = 0;
    let totalPar = 0;
    
    for (const result of results) {
        const hole = layout.holes.find((h) => h.holeNumber === result.holeNumber);
        if (hole) {
            totalScore += result.score;
            totalPar += hole.par;
        }
    }
    
    return totalScore > totalPar ? 1 : 0;
}`;
        } else {
            // Just count rounds
            return `(results, layout) => {
    return 1;
}`;
        }
    }
    
    // Hole patterns
    if (descLower.includes('hål') || descLower.includes('hole') || descLower.includes('holes')) {
        return `(results, layout) => {
    return results.length;
}`;
    }
    
    // Throw patterns
    if (descLower.includes('kast') || descLower.includes('throw') || descLower.includes('throws')) {
        return `(results, layout) => {
    const totalAmount = results.reduce((accumulator, current) => accumulator + current.score, 0);
    return totalAmount;
}`;
    }
    
    // Course patterns
    if (descLower.includes('bana') || descLower.includes('course') || descLower.includes('banor') || descLower.includes('courses')) {
        if (descLower.includes('olika') || descLower.includes('different') || descLower.includes('unique')) {
            return `(results, layout) => {
    const uniqueCourses = new Set(results.map((r) => r.courseId).filter(id => id));
    return uniqueCourses.size;
}`;
        } else {
            return `(results, layout) => {
    return 1;
}`;
        }
    }
    
    // Win patterns (multiplayer)
    if (isMultiplayer) {
        if (descLower.includes('dubbel') || descLower.includes('doubles')) {
            // Doubles win - need to check if player is part of winning team
            return `(results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Group results by team (assuming teamId or similar exists)
    // For now, treat as singles match
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
}`;
        } else {
            // Singles win
            return `(results, layout, allOtherPlayersResults) => {
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
}`;
        }
    }
    
    // Recovery patterns
    if (descLower.includes('recovery') || descLower.includes('återhämtning')) {
        if (descLower.includes('ob') && descLower.includes('par')) {
            // Par after OB
            return `(results, layout) => {
    const recoveries = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par && r.obCount > 0;
    }).length;
    return recoveries || 0;
}`;
        } else if (descLower.includes('ob') && descLower.includes('birdie')) {
            // Birdie after OB
            return `(results, layout) => {
    const skilledRecoveries = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par - 1 && r.obCount > 0;
    }).length;
    return skilledRecoveries || 0;
}`;
        }
    }
    
    // Scramble patterns
    if (descLower.includes('scramble')) {
        return `(results, layout) => {
    const scrambles = results.filter((r) => {
        return r.specifics && r.specifics.scramble === true;
    }).length;
    return scrambles || 0;
}`;
    }
    
    // Throw-in patterns
    if (descLower.includes('throw-in') || descLower.includes('throwin')) {
        return `(results, layout) => {
    const throwIns = results.filter((r) => {
        return r.specifics && r.specifics.throwIn === true;
    }).length;
    return throwIns || 0;
}`;
    }
    
    // Distance patterns
    if (descLower.includes('längd') || descLower.includes('distance') || descLower.includes('length')) {
        return `(results, layout) => {
    if (!layout || !Array.isArray(layout.holes)) {
        return 0;
    }
    
    let totalLength = 0;
    for (const hole of layout.holes) {
        if (typeof hole.length !== 'number' || isNaN(hole.length)) {
            return 0;
        }
        
        if (hole.measureInMeters !== true) {
            return 0;
        }
        
        totalLength += hole.length;
    }
    
    const totalLengthInKilometers = Math.round(totalLength / 1000);
    return totalLengthInKilometers;
}`;
    }
    
    // Turkey patterns (3 consecutive birdies)
    if (descLower.includes('turkey') || descLower.includes('turkeys')) {
        return `(results, layout) => {
    if (results.length < 3) {
        return 0;
    }
    
    let turkeyCount = 0;
    
    for (let i = 2; i < results.length; i++) {
        const result1 = results[i - 2];
        const result2 = results[i - 1];
        const result3 = results[i];
        
        const hole1 = layout.holes.find((h) => h.holeNumber === result1.holeNumber);
        const hole2 = layout.holes.find((h) => h.holeNumber === result2.holeNumber);
        const hole3 = layout.holes.find((h) => h.holeNumber === result3.holeNumber);
        
        const birdie1 = hole1 && result1.score === hole1.par - 1;
        const birdie2 = hole2 && result2.score === hole2.par - 1;
        const birdie3 = hole3 && result3.score === hole3.par - 1;
        
        if (birdie1 && birdie2 && birdie3) {
            turkeyCount++;
        }
    }
    
    return turkeyCount;
}`;
    }
    
    // Albatross patterns (par - 3)
    if (descLower.includes('albatross')) {
        return `(results, layout) => {
    const albatrosses = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par - 3;
    }).length;
    return albatrosses || 0;
}`;
    }
    
    // Fairway patterns
    if (descLower.includes('fairway') || descLower.includes('träffat fairway')) {
        return `(results, layout) => {
    const fairways = results.filter((r) => {
        return r.fairwayHit === true;
    }).length;
    return fairways || 0;
}`;
    }
    
    // Win without par patterns
    if (descLower.includes('vinner utan') || descLower.includes('win without') || descLower.includes('utan något par')) {
        return `(results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Check if player has any pars
    const hasPar = results.some((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par;
    });
    
    if (hasPar) {
        return 0;
    }
    
    // Check if player won
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
}`;
    }
    
    // Win with X bogeys patterns
    if (descLower.includes('vinner trots') || descLower.includes('win despite')) {
        const bogeyMatch = funcDesc.match(/(\d+)\s*bogeys?/i);
        const bogeyCount = bogeyMatch ? parseInt(bogeyMatch[1]) : 7;
        
        return `(results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Count bogeys
    const bogeys = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par + 1;
    }).length;
    
    if (bogeys < ${bogeyCount}) {
        return 0;
    }
    
    // Check if player won
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
}`;
    }
    
    // Comeback patterns (win after being X strokes behind)
    if (descLower.includes('poäng bakom') || descLower.includes('poäng efter') || descLower.includes('strokes behind')) {
        const pointsMatch = funcDesc.match(/(\d+)\s*(poäng|points|strokes)/i);
        const pointsBehind = pointsMatch ? parseInt(pointsMatch[1]) : 3;
        
        return `(results, layout, allOtherPlayersResults) => {
    if (!allOtherPlayersResults || !allOtherPlayersResults.length) {
        return 0;
    }
    
    // Check if player won
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
    
    // Check if player won
    if (currentPlayerTotal >= bestOpponentTotal) {
        return 0;
    }
    
    // Check if player was ever X points behind during the round
    let wasBehind = false;
    let currentPlayerRunningTotal = 0;
    const opponentRunningTotals = {};
    
    for (let i = 0; i < results.length; i++) {
        currentPlayerRunningTotal += results[i].score;
        
        // Update opponent totals up to this point
        const resultsSoFar = allOtherPlayersResults.filter(or => {
            const resultIndex = results.findIndex(r => r.holeNumber === or.holeNumber);
            return resultIndex !== -1 && resultIndex <= i;
        });
        
        for (const otherResult of resultsSoFar) {
            const playerId = String(otherResult.playerId);
            if (!opponentRunningTotals[playerId]) {
                opponentRunningTotals[playerId] = 0;
            }
            opponentRunningTotals[playerId] += otherResult.score;
        }
        
        const bestOpponentRunningTotal = Math.min(...Object.values(opponentRunningTotals));
        
        if (currentPlayerRunningTotal - bestOpponentRunningTotal >= ${pointsBehind}) {
            wasBehind = true;
            break;
        }
    }
    
    return wasBehind ? 1 : 0;
}`;
    }
    
    // Seasonal/date-based badges
    if (descLower.includes('julafton') || descLower.includes('christmas')) {
        return `(results, layout) => {
    const christmasEve = results.some((r) => {
        if (!r.timestamp) return false;
        const date = new Date(r.timestamp);
        return date.getMonth() === 11 && date.getDate() === 24;
    });
    return christmasEve ? 1 : 0;
}`;
    }
    
    if (descLower.includes('nyårsafton') || descLower.includes('new year')) {
        return `(results, layout) => {
    const newYearsEve = results.some((r) => {
        if (!r.timestamp) return false;
        const date = new Date(r.timestamp);
        return date.getMonth() === 11 && date.getDate() === 31;
    });
    return newYearsEve ? 1 : 0;
}`;
    }
    
    if (descLower.includes('påskafton') || descLower.includes('easter')) {
        return `(results, layout) => {
    const easter = results.some((r) => {
        if (!r.timestamp) return false;
        const date = new Date(r.timestamp);
        const month = date.getMonth();
        return month === 2 || month === 3;
    });
    return easter ? 1 : 0;
}`;
    }
    
    if (descLower.includes('thanksgiving')) {
        return `(results, layout) => {
    const thanksgiving = results.some((r) => {
        if (!r.timestamp) return false;
        const date = new Date(r.timestamp);
        if (date.getMonth() !== 10) return false;
        const day = date.getDate();
        const dayOfWeek = date.getDay();
        return day >= 22 && day <= 28 && dayOfWeek === 4;
    });
    return thanksgiving ? 1 : 0;
}`;
    }
    
    if (descLower.includes('halloween')) {
        return `(results, layout) => {
    const halloween = results.some((r) => {
        if (!r.timestamp) return false;
        const date = new Date(r.timestamp);
        return date.getMonth() === 9 && date.getDate() === 31;
    });
    return halloween ? 1 : 0;
}`;
    }
    
    // Default fallback - return 0
    console.warn(`No pattern matched for: ${name} (${id}) - "${funcDesc}"`);
    return `(results, layout) => {
    // TODO: Implement condition for: ${funcDesc}
    return 0;
}`;
}

// Generate conditions for all undone badges
const generatedConditions = [];

for (const badge of undoneBadges) {
    const condition = generateCondition(badge);
    generatedConditions.push({
        id: badge.id,
        name: badge.name,
        functionalDescription: badge.functionalDescription,
        condition: condition,
        isUnique: badge.isUnique || false,
        type: badge.type || 'tiered'
    });
}

// Save to JSON file
const outputPath = path.join(__dirname, 'generated-conditions.json');
fs.writeFileSync(outputPath, JSON.stringify(generatedConditions, null, 2));

console.log(`\nGenerated ${generatedConditions.length} conditions`);
console.log(`Saved to: ${outputPath}`);

// Show summary
const withConditions = generatedConditions.filter(c => !c.condition.includes('TODO')).length;
const withoutConditions = generatedConditions.length - withConditions;

console.log(`\nSummary:`);
console.log(`  - Conditions generated: ${withConditions}`);
console.log(`  - Needs manual review: ${withoutConditions}`);

if (withoutConditions > 0) {
    console.log(`\nBadges needing manual review:`);
    generatedConditions
        .filter(c => c.condition.includes('TODO'))
        .forEach(c => {
            console.log(`  - ${c.name} (${c.id}): "${c.functionalDescription}"`);
        });
}

