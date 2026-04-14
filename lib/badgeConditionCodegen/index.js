const { emitCondition, BUILDER_VERSION } = require('./emit');
const { dryRunRound, dryRunHistorical } = require('./dryRun');
const { inferBuilderFromCondition } = require('./infer');
const { catalog } = require('./catalog');
const {
  extractRoundFunctionBody,
  extractHistoricalFunctionBody,
  normalizeWhitespace
} = require('./parseBody');

module.exports = {
  emitCondition,
  BUILDER_VERSION,
  dryRunRound,
  dryRunHistorical,
  inferBuilderFromCondition,
  catalog,
  extractRoundFunctionBody,
  extractHistoricalFunctionBody,
  normalizeWhitespace
};
