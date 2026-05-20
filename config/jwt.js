const JWT_ISSUER = process.env.JWT_ISSUER || 'chain-out-api';

const JWT_AUDIENCES = {
  app: process.env.JWT_AUDIENCE_APP || 'chain-out-app',
  admin: process.env.JWT_AUDIENCE_ADMIN || 'chain-out-admin',
};

const JWT_ALLOWED_AUDIENCES = Object.values(JWT_AUDIENCES);

function resolveAudience(req) {
  const client = req.body?.client ?? req.headers['x-client-type'];
  if (client === 'admin') return JWT_AUDIENCES.admin;
  return JWT_AUDIENCES.app;
}

function jwtVerifyOptions() {
  return {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_ALLOWED_AUDIENCES,
  };
}

function jwtSignOptions(audience, expiresIn) {
  return {
    algorithm: 'HS256',
    expiresIn,
    issuer: JWT_ISSUER,
    audience,
  };
}

/** Preserve app vs admin audience when rotating tokens after refresh. */
function tokenAudienceFromDecoded(decoded) {
  const aud = decoded.aud;
  if (typeof aud === 'string') return aud;
  if (Array.isArray(aud) && aud.length > 0) return aud[0];
  return JWT_AUDIENCES.app;
}

module.exports = {
  JWT_ISSUER,
  JWT_AUDIENCES,
  JWT_ALLOWED_AUDIENCES,
  resolveAudience,
  jwtVerifyOptions,
  jwtSignOptions,
  tokenAudienceFromDecoded,
};
