const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

function configuredOrigins() {
  return [process.env.APP_PUBLIC_URL, ...(process.env.AI_ALLOWED_ORIGINS || '').split(',')]
    .map((value) => {
      const candidate = String(value || '').trim();
      if (!candidate) return '';
      try { return new URL(candidate).origin; } catch { return candidate.replace(/\/$/, ''); }
    })
    .filter(Boolean);
}

export function applyCors(request, response) {
  const origin = String(request.headers.origin || '').replace(/\/$/, '');
  if (origin && (LOCAL_ORIGIN.test(origin) || configuredOrigins().includes(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

export function requireBearerToken(request) {
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Sign in before using Cloud AI.'), { status: 401, code: 'authentication_required' });
  return match[1];
}

export function sendError(response, error) {
  const status = Number(error.status) || 500;
  const safeMessage = status >= 500 ? 'Cloud AI could not complete this request.' : error.message;
  return response.status(status).json({ error: safeMessage, code: error.code || 'cloud_ai_error' });
}
