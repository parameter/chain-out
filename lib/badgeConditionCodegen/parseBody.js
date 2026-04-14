/**
 * Extract executable function body from a round badge condition string,
 * matching lib/badges.js executeBadgeCondition behavior (first { to last }).
 */
function extractRoundFunctionBody(source) {
  if (!source || typeof source !== 'string') return null;
  const trimmed = source.trim();
  const functionStart = trimmed.indexOf('{');
  const functionEnd = trimmed.lastIndexOf('}');
  if (functionStart === -1 || functionEnd === -1 || functionEnd <= functionStart) {
    return null;
  }
  return trimmed.substring(functionStart + 1, functionEnd).trim();
}

/**
 * Extract body for historical badge condition — same rules as
 * lib/badges.js buildHistoricalAggregateFromCondition.
 */
function extractHistoricalFunctionBody(source) {
  if (!source || typeof source !== 'string') return null;
  let trimmed = source.trim();

  const arrowFunctionMatch = trimmed.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\{/);
  if (arrowFunctionMatch) {
    let braceCount = 0;
    let functionStart = -1;
    let functionEnd = -1;
    const arrowIndex = trimmed.indexOf('=>');
    if (arrowIndex !== -1) {
      for (let i = arrowIndex; i < trimmed.length; i++) {
        if (trimmed[i] === '{') {
          if (braceCount === 0) functionStart = i;
          braceCount++;
        } else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0 && functionStart !== -1) {
            functionEnd = i;
            break;
          }
        }
      }
    }
    if (functionStart !== -1 && functionEnd !== -1) {
      trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
    }
  } else {
    const functionDeclMatch = trimmed.match(/^\s*function\s*\([^)]*\)\s*\{/);
    if (functionDeclMatch) {
      let braceCount = 0;
      let functionStart = -1;
      let functionEnd = -1;
      const funcIndex = trimmed.indexOf('function');
      if (funcIndex !== -1) {
        for (let i = funcIndex; i < trimmed.length; i++) {
          if (trimmed[i] === '{') {
            if (braceCount === 0) functionStart = i;
            braceCount++;
          } else if (trimmed[i] === '}') {
            braceCount--;
            if (braceCount === 0 && functionStart !== -1) {
              functionEnd = i;
              break;
            }
          }
        }
      }
      if (functionStart !== -1 && functionEnd !== -1) {
        trimmed = trimmed.substring(functionStart + 1, functionEnd).trim();
      }
    }
  }
  return trimmed;
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = {
  extractRoundFunctionBody,
  extractHistoricalFunctionBody,
  normalizeWhitespace
};
