const { getDatabase } = require('../config/database');

const badges = [
    {
      name: 'Birdie hunter',
      description: 'Make your first birdie.',
      condition: (results, layout) => {
        // Check if any score is 1 under par (birdie)
        return results.some(result => {
          const hole = layout.holes.find(h => h.number === result.hole);
          return hole && result.score === hole.par - 1;
        });
      }
    },
    {
      name: 'Eagle eye',
      description: 'Make your first eagle.',
      condition: (results, layout) => {
        return results.some(result => {
          const hole = layout.holes.find(h => h.number === result.hole);
          return hole && result.score === hole.par - 2;
        });
      }
    },
    {
      name: 'Hole in one',
      description: 'Get a hole in one.',
      condition: (results, layout) => {
        return results.some(result => result.score === 1);
      }
    },
    {
      name: 'Under par round',
      description: 'Complete a round under par.',
      condition: (results, layout) => {
        const totalScore = results.reduce((sum, result) => sum + result.score, 0);
        const totalPar = layout.holes.reduce((sum, hole) => sum + hole.par, 0);
        return totalScore < totalPar;
      }
    },
    {
      name: 'Consistent player',
      description: 'Score par or better on 5 consecutive holes.',
      condition: (results, layout) => {
        const sortedResults = results.sort((a, b) => a.hole - b.hole);
        let consecutiveCount = 0;
        
        for (const result of sortedResults) {
          const hole = layout.holes.find(h => h.number === result.hole);
          if (hole && result.score <= hole.par) {
            consecutiveCount++;
            if (consecutiveCount >= 5) return true;
          } else {
            consecutiveCount = 0;
          }
        }
        return false;
      }
    }
];

const searchForEarnedBadges = async ({ results, courseId, layout, userId }) => {
  const db = getDatabase();
  const badgesCollection = db.collection('badges');

  const earnedBadges = [];
  for (const badge of badges) {
    if (badge.condition(results, layout)) {
      earnedBadges.push(badge);
    }
  }
  
  const badgeNames = earnedBadges.map(badge => badge.name);
  const existingBadges = await badgesCollection.find({
    userId: userId,
    courseId: courseId,
    layoutId: layout._id,
    badgeName: { $in: badgeNames }
  }).toArray();

  const existingBadgeNames = new Set(existingBadges.map(b => b.badgeName));

  const newBadges = earnedBadges.filter(badge => !existingBadgeNames.has(badge.name)).map(badge => ({
    userId: userId,
    badgeName: badge.name,
    courseId: courseId,
    layoutId: layout._id,
    dateEarned: new Date(),
    verified: 'pending',
    verifiedBy: null
  }));

  if (newBadges.length > 0) {
    await badgesCollection.insertMany(newBadges);
  }
  
  return earnedBadges;
}

export { searchForEarnedBadges };