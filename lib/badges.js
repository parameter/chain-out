const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

const badges = [
    {
      name: 'Birdie hunter',
      description: 'Make your first birdie.',
      condition: (results, layout) => {
        // Check if any score is 1 under par (birdie)
        return results.some(result => {
          const hole = layout.holes.find(h => h.number === result.holeNumber);
          return hole && result.score === hole.par - 1;
        });
      }
    },
    {
      name: 'Eagle eye',
      description: 'Make your first eagle.',
      condition: (results, layout) => {
        return results.some(result => {
          const hole = layout.holes.find(h => h.number === result.holeNumber);
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
        const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);
        let consecutiveCount = 0;

        for (const result of sortedResults) {
          const hole = layout.holes.find(h => h.number === result.holeNumber);
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

const searchForEarnedBadges = async (scorecardInput) => {
  const db = getDatabase();
  const badgesCollection = db.collection('badges');

  // Support passing a raw scorecard doc or a findOneAndUpdate result
  const scorecard = scorecardInput && scorecardInput.value ? scorecardInput.value : scorecardInput;
  if (!scorecard) return {};

  const courseId = scorecard.courseId;
  const layout = scorecard.layout || {};
  const holes = (layout.latestVersion && Array.isArray(layout.latestVersion.holes))
    ? layout.latestVersion.holes
    : Array.isArray(layout.holes) ? layout.holes : [];

  // Normalize layout shape used by badge conditions
  const normalizedLayout = {
    holes: holes.map((h, index) => ({
      number: h.number !== undefined ? h.number : (h.holeNumber !== undefined ? h.holeNumber : index + 1),
      par: h.par !== undefined ? h.par : (h.parValue !== undefined ? h.parValue : 3)
    }))
  };

  const results = Array.isArray(scorecard.results) ? scorecard.results : [];
  const uniquePlayerIds = Array.from(new Set(results.map(r => String(r.playerId))));

  const perPlayerEarned = {};
  const docsToInsert = [];

  for (const playerIdStr of uniquePlayerIds) {
    const playerResults = results.filter(r => String(r.playerId) === playerIdStr);

    const earnedForPlayer = [];
    for (const badge of badges) {
      try {
        if (badge.condition(playerResults, normalizedLayout)) {
          earnedForPlayer.push(badge);
        }
      } catch (_) {
        // ignore condition errors and continue
      }
    }

    if (earnedForPlayer.length === 0) {
      perPlayerEarned[playerIdStr] = [];
      continue;
    }

    const badgeNames = earnedForPlayer.map(b => b.name);

    // Try to coerce to ObjectId when possible
    let userIdForQuery = playerIdStr;
    try {
      if (ObjectId.isValid(playerIdStr)) userIdForQuery = new ObjectId(playerIdStr);
    } catch (_) {}

    const existing = await badgesCollection.find({
      userId: userIdForQuery,
      courseId: courseId,
      layoutId: layout && (layout._id || layout.id),
      badgeName: { $in: badgeNames }
    }).toArray();

    const existingSet = new Set(existing.map(b => b.badgeName));

    for (const badge of earnedForPlayer) {
      if (!existingSet.has(badge.name)) {
        docsToInsert.push({
          userId: userIdForQuery,
          badgeName: badge.name,
          courseId: courseId,
          layoutId: layout && (layout._id || layout.id),
          dateEarned: new Date(),
          verified: 'pending',
          verifiedBy: null
        });
      }
    }

    perPlayerEarned[playerIdStr] = earnedForPlayer.map(b => b.name);
  }

  if (docsToInsert.length > 0) {
    await badgesCollection.insertMany(docsToInsert);
  }

  return perPlayerEarned;
};

module.exports = searchForEarnedBadges;