// Pure function tests for the "turkey_hunter" badge condition.
// A "turkey" is defined as 3 birdies in a row.
// 6 birdies in a row should count as 2 non‑overlapping turkeys.

function turkeyHunterCondition(results, layout) {
  if (!Array.isArray(results) || results.length < 3) {
    return 0;
  }

  const holes = Array.isArray(layout?.holes) ? layout.holes : [];

  // Ensure results are ordered by holeNumber so streak logic is deterministic
  const sortedResults = [...results].sort((a, b) => a.holeNumber - b.holeNumber);

  let turkeyCount = 0;
  let consecutiveBirdies = 0;

  for (const r of sortedResults) {
    const hole = holes.find(
      (h) => (h.holeNumber ?? h.number) === r.holeNumber
    );

    const isBirdie = hole && typeof hole.par === 'number' && r.score === hole.par - 1;

    if (isBirdie) {
      consecutiveBirdies += 1;

      if (consecutiveBirdies === 3) {
        turkeyCount += 1;
        // Reset the streak so we count **non‑overlapping** groups of 3 birdies
        // Example: 6 birdies in a row => 2 turkeys, not 4.
        consecutiveBirdies = 0;
      }
    } else {
      consecutiveBirdies = 0;
    }
  }

  return turkeyCount;
}

// Simple 9‑hole par‑3 layout for testing
const testLayout = {
  holes: Array.from({ length: 9 }).map((_, i) => ({
    holeNumber: i + 1,
    number: i + 1,
    par: 3,
  })),
};

function makeResults(scores) {
  return scores.map((score, idx) => ({
    playerId: 'test-player',
    holeNumber: idx + 1,
    score,
  }));
}

function runTest(name, scores, expectedTurkeys) {
  const results = makeResults(scores);
  const actual = turkeyHunterCondition(results, testLayout);
  const pass = actual === expectedTurkeys;

  console.log(`\n=== ${name} ===`);
  console.log(`Scores:           ${scores.join(', ')}`);
  console.log(`Expected turkeys: ${expectedTurkeys}`);
  console.log(`Actual turkeys:   ${actual}`);
  console.log(`Result:           ${pass ? 'PASS' : 'FAIL'}`);
}

if (require.main === module) {
  console.log('🧪 Testing turkey_hunter condition (pure function)...');

  // 1) Exactly one turkey: 3 birdies in a row
  runTest(
    'Case 1: Single turkey (3 birdies)',
    // 3 holes: all birdies
    [2, 2, 2],
    1
  );

  // 2) Two turkeys: 6 birdies in a row => should be 2 non‑overlapping groups
  runTest(
    'Case 2: Two turkeys (6 birdies)',
    // 6 birdies in a row on a par‑3 layout
    [2, 2, 2, 2, 2, 2],
    2
  );

  // 3) Two separated turkeys with a break in between
  runTest(
    'Case 3: Two separated turkeys',
    // Birdie x3, then par, then birdie x3 again
    [2, 2, 2, 3, 2, 2, 2],
    2
  );

  // 4) No turkey: only 2 birdies max in a row
  runTest(
    'Case 4: No turkey (only streaks of 2)',
    [2, 2, 3, 2, 2, 3],
    0
  );

  console.log('\n✨ turkey_hunter function tests completed.');
}

module.exports = { turkeyHunterCondition };

