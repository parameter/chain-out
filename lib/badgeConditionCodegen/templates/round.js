/**
 * Round badge condition generators: full stored string (arrow function)
 * compatible with executeBadgeCondition in lib/badges.js.
 */

function roundArrow(bodyInner) {
  /* Match common DB export style (two params); runtime still passes allOtherPlayersResults. */
  return `(results, layout) => {\n${bodyInner}\n}`;
}

const generators = {
  /** Canonical birdie count — matches birdie_hunter export style */
  round_birdie_hunter(_params) {
    return roundArrow(`    const birdies = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par - 1;
    }).length;
    return birdies;`);
  },

  /**
   * Count strokes where score - par === relativeToPar (e.g. -1 = birdie, 1 = bogey).
   * @param {{ relativeToPar: number }} params
   */
  round_count_vs_par(params) {
    const rel = Number(params.relativeToPar);
    if (!Number.isFinite(rel)) throw new Error('relativeToPar must be a number');
    return roundArrow(`    const n = results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par + ${JSON.stringify(rel)};
    }).length;
    return n;`);
  },

  /** Eagles (not hole-in-one): par - 2 */
  round_eagle_count(_params) {
    return roundArrow(`    return results.filter((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score !== 1 && r.score === hole.par - 2;
    }).length;`);
  },

  /** At least one ace */
  round_ace_boolean(_params) {
    return roundArrow(`    return results.some((r) => r.score === 1 && r.isAce === true) ? 1 : 0;`);
  },

  /** Distinct courses in results */
  round_distinct_courses(_params) {
    return roundArrow(`    const distinct = new Set(results.map((r) => r.courseId).filter(Boolean));
    return distinct.size;`);
  },

  /** Bogey-free card: 1 if no bogeys, else 0 */
  round_bogey_free_round(_params) {
    return roundArrow(`    const hasBogeys = results.some((r) => {
        const hole = layout.holes.find((h) => h.holeNumber === r.holeNumber);
        return hole && r.score === hole.par + 1;
    });
    return hasBogeys ? 0 : 1;`);
  },

  /**
   * Count results where putt field equals value (e.g. inside / outside).
   * @param {{ puttEquals: string }} params
   */
  round_putt_equals(params) {
    const v = String(params.puttEquals || 'inside');
    return roundArrow(`    return results.filter((r) => r.putt === ${JSON.stringify(v)}).length;`);
  }
};

module.exports = { generators, roundArrow };
