const { emitCondition, BUILDER_VERSION } = require('./emit');
const {
  normalizeWhitespace,
  extractHistoricalFunctionBody
} = require('./parseBody');
const { catalog } = require('./catalog');

/**
 * @param {object|null} conditionBuilder - persisted builder state
 * @param {string} condition - current condition string
 * @param {boolean} requiresHistoricalData
 * @returns {{ status: 'known', conditionBuilder: object } | { status: 'unknown', reason?: string }}
 */
function inferBuilderFromCondition(conditionBuilder, condition, requiresHistoricalData) {
  const condStr = String(condition || '');

  if (
    conditionBuilder &&
    typeof conditionBuilder === 'object' &&
    conditionBuilder.version === BUILDER_VERSION &&
    conditionBuilder.templateId &&
    conditionBuilder.mode
  ) {
    try {
      const { condition: emitted } = emitCondition({
        mode: conditionBuilder.mode,
        templateId: conditionBuilder.templateId,
        params: conditionBuilder.params || {}
      });
      if (conditionsMatch(conditionBuilder.mode, emitted, condStr)) {
        return { status: 'known', conditionBuilder };
      }
    } catch {
      // fall through to template scan
    }
  }

  const mode = requiresHistoricalData ? 'historical' : 'round';
  const candidates = catalog.filter((t) => t.mode === mode);

  for (const t of candidates) {
    const tryParams = guessParamsForTemplate(t.id, condition, mode);
    if (!tryParams) continue;
    try {
      const { condition: emitted, conditionBuilder: cb } = emitCondition({
        mode,
        templateId: t.id,
        params: tryParams
      });
      if (conditionsMatch(mode, emitted, condStr)) {
        return { status: 'known', conditionBuilder: cb };
      }
    } catch {
      continue;
    }
  }

  return {
    status: 'unknown',
    reason: 'Condition does not match a built-in template. Pick a template and re-enter parameters.'
  };
}

function conditionsMatch(mode, emitted, stored) {
  if (mode === 'historical') {
    const a = normalizeWhitespace(extractHistoricalFunctionBody(emitted));
    const b = normalizeWhitespace(extractHistoricalFunctionBody(stored));
    return a === b;
  }
  return normalizeWhitespace(emitted) === normalizeWhitespace(stored);
}

function guessParamsForTemplate(templateId, condition, mode) {
  const n =
    mode === 'historical'
      ? normalizeWhitespace(extractHistoricalFunctionBody(String(condition || '')))
      : normalizeWhitespace(String(condition || ''));

  if (mode === 'round') {
    if (templateId === 'round_count_vs_par') {
      for (let rel = -3; rel <= 3; rel++) {
        try {
          const { condition: em } = emitCondition({
            mode: 'round',
            templateId: 'round_count_vs_par',
            params: { relativeToPar: rel }
          });
          if (normalizeWhitespace(em) === n) return { relativeToPar: rel };
        } catch {
          continue;
        }
      }
      return null;
    }
    if (templateId === 'round_putt_equals') {
      const common = ['inside', 'outside', 'none', ''];
      for (const puttEquals of common) {
        try {
          const { condition: em } = emitCondition({
            mode: 'round',
            templateId: 'round_putt_equals',
            params: { puttEquals }
          });
          if (normalizeWhitespace(em) === n) return { puttEquals };
        } catch {
          continue;
        }
      }
      return null;
    }
    try {
      const { condition: em } = emitCondition({ mode: 'round', templateId, params: {} });
      if (normalizeWhitespace(em) === n) return {};
    } catch {
      return null;
    }
    return null;
  }

  if (mode === 'historical') {
    if (templateId === 'hist_distinct_courses_last_days') {
      for (const days of [1, 7, 14, 30]) {
        for (const asProgress of [true, false]) {
          try {
            const { condition: em } = emitCondition({
              mode: 'historical',
              templateId: 'hist_distinct_courses_last_days',
              params: { days, asProgress }
            });
            if (normalizeWhitespace(em) === n) return { days, asProgress };
          } catch {
            continue;
          }
        }
      }
      return null;
    }
    try {
      const { condition: em } = emitCondition({ mode: 'historical', templateId, params: {} });
      if (normalizeWhitespace(em) === n) return {};
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = { inferBuilderFromCondition };
