const { generators: roundGenerators } = require('./templates/round');
const { generators: historicalGenerators } = require('./templates/historical');

const BUILDER_VERSION = 1;

/**
 * @param {{ mode: 'round'|'historical', templateId: string, params?: object }}
 * @returns {{ condition: string, conditionBuilder: object }}
 */
function emitCondition({ mode, templateId, params = {} }) {
  if (mode === 'round') {
    const gen = roundGenerators[templateId];
    if (!gen) throw new Error(`Unknown round template: ${templateId}`);
    const condition = gen(params);
    return {
      condition,
      conditionBuilder: {
        version: BUILDER_VERSION,
        mode: 'round',
        templateId,
        params
      }
    };
  }
  if (mode === 'historical') {
    const gen = historicalGenerators[templateId];
    if (!gen) throw new Error(`Unknown historical template: ${templateId}`);
    const condition = gen(params);
    return {
      condition,
      conditionBuilder: {
        version: BUILDER_VERSION,
        mode: 'historical',
        templateId,
        params
      }
    };
  }
  throw new Error(`Invalid mode: ${mode}`);
}

module.exports = { emitCondition, BUILDER_VERSION };
