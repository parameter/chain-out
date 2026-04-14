const { ObjectId } = require('mongodb');
const { extractRoundFunctionBody, extractHistoricalFunctionBody } = require('./parseBody');

function dryRunRound(conditionString) {
  const body = extractRoundFunctionBody(conditionString);
  if (!body) throw new Error('Could not parse round condition body');
  const fn = new Function('results', 'layout', 'allOtherPlayersResults', body);
  const layout = {
    holes: [
      { holeNumber: 1, number: 1, par: 3 },
      { holeNumber: 2, number: 2, par: 4 }
    ]
  };
  const results = [
    { holeNumber: 1, score: 2, courseId: 'c1', putt: 'inside', isAce: false },
    { holeNumber: 2, score: 5, courseId: 'c1', putt: 'outside', isAce: false }
  ];
  return fn(results, layout, []);
}

function dryRunHistorical(conditionString) {
  const body = extractHistoricalFunctionBody(conditionString);
  if (!body) throw new Error('Could not parse historical condition body');
  const fn = new Function(
    'playerIdObj',
    'playerIdStr',
    'courseId',
    'courseIdStr',
    'ObjectId',
    'now',
    body
  );
  const oid = new ObjectId();
  const courseId = new ObjectId();
  const config = fn(oid, String(oid), courseId, String(courseId), ObjectId, new Date());
  if (!config || !Array.isArray(config.facetPipeline)) {
    throw new Error('Historical condition must return { facetPipeline: [...], valueField, ... }');
  }
  if (!config.valueField) {
    throw new Error('Historical condition must include valueField');
  }
  return config;
}

module.exports = { dryRunRound, dryRunHistorical };
