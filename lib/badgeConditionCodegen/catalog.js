/**
 * Template catalog for GET /admin/api/badge-builder/templates
 */
const catalog = [
  {
    id: 'round_birdie_hunter',
    mode: 'round',
    label: 'Count birdies',
    description: 'Counts holes where score equals par minus one.',
    paramSchema: []
  },
  {
    id: 'round_count_vs_par',
    mode: 'round',
    label: 'Count vs par',
    description: 'Count holes where score = par + offset (e.g. -1 birdie, 0 par, 1 bogey).',
    paramSchema: [
      {
        key: 'relativeToPar',
        label: 'Relative to par',
        type: 'number',
        default: -1,
        description: 'Use -2 eagle, -1 birdie, 0 par, 1 bogey, 2 double-bogey'
      }
    ]
  },
  {
    id: 'round_eagle_count',
    mode: 'round',
    label: 'Count eagles (non-ace)',
    description: 'Counts eagles where score is par minus two and not a hole-in-one.',
    paramSchema: []
  },
  {
    id: 'round_ace_boolean',
    mode: 'round',
    label: 'Any ace this round',
    description: 'Returns 1 if any result is ace, else 0.',
    paramSchema: []
  },
  {
    id: 'round_distinct_courses',
    mode: 'round',
    label: 'Distinct courses (this round)',
    description: 'Number of distinct courseId values in results.',
    paramSchema: []
  },
  {
    id: 'round_bogey_free_round',
    mode: 'round',
    label: 'Bogey-free round',
    description: 'Returns 1 if no bogeys on the card, else 0.',
    paramSchema: []
  },
  {
    id: 'round_putt_equals',
    mode: 'round',
    label: 'Count by putt value',
    description: 'Counts results where putt field equals a value (e.g. inside).',
    paramSchema: [
      {
        key: 'puttEquals',
        label: 'Putt equals',
        type: 'string',
        default: 'inside',
        description: 'Typical values: inside, outside'
      }
    ]
  },
  {
    id: 'hist_rounds_on_current_course',
    mode: 'historical',
    label: 'Rounds on current course (historical)',
    description: 'Counts completed scorecards on the current course via aggregation.',
    paramSchema: []
  },
  {
    id: 'hist_distinct_courses_last_days',
    mode: 'historical',
    label: 'Distinct courses in last N days',
    description: 'Counts distinct courses played in a rolling window.',
    paramSchema: [
      {
        key: 'days',
        label: 'Window (days)',
        type: 'integer',
        default: 7,
        min: 1,
        max: 3650
      },
      {
        key: 'asProgress',
        label: 'As progress (tiered)',
        type: 'boolean',
        default: true,
        description: 'Include asProgress: true in aggregate config'
      }
    ]
  }
];

module.exports = { catalog };
