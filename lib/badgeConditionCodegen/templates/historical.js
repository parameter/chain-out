/**
 * Historical badge conditions: function body only (no wrapper), for
 * buildHistoricalAggregateFromCondition in lib/badges.js.
 */

const generators = {
  /** Count completed scorecards on the current course */
  hist_rounds_on_current_course(_params) {
    return `const facetPipeline = [
  {
    $match: {
      courseId: courseId
    }
  },
  {
    $group: {
      _id: null,
      value: { $sum: 1 }
    }
  }
];

return {
  facetPipeline,
  valueField: 'value',
  asProgress: true
};`;
  },

  /**
   * Distinct courses played within the last N days (rolling window).
   * @param {{ days: number, asProgress?: boolean }} params
   */
  hist_distinct_courses_last_days(params) {
    const days = Math.max(1, Math.min(3650, parseInt(String(params.days), 10) || 7));
    const asProgress = params.asProgress !== false;
    const tail = asProgress
      ? `return {
  facetPipeline,
  valueField: 'value',
  asProgress: true
};`
      : `return {
  facetPipeline,
  valueField: 'value'
};`;
    return `const windowMs = ${days} * 24 * 60 * 60 * 1000;
const windowStart = new Date(now.getTime() - windowMs);

const facetPipeline = [
  {
    $match: {
      $expr: {
        $gte: [
          {
            $ifNull: [
              '$updatedAt',
              { $ifNull: ['$completedAt', '$createdAt'] }
            ]
          },
          windowStart
        ]
      }
    }
  },
  {
    $group: {
      _id: '$courseId'
    }
  },
  {
    $group: {
      _id: null,
      value: { $sum: 1 }
    }
  }
];

${tail}`;
  }
};

module.exports = { generators };
