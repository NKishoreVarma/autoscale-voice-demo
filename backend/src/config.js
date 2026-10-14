// Centralized, validated configuration. Secrets come ONLY from environment variables.
// Never import this into client code.

function num(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function list(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num('PORT', 8080),

  // Comma-separated list of admin emails authorized to initiate calls.
  // Server-side source of truth for authorization (NOT the client).
  adminAllowlist: list('ADMIN_ALLOWLIST'),

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    // Path to a service-account JSON OR rely on GOOGLE_APPLICATION_CREDENTIALS /
    // Application Default Credentials. Never commit this file.
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  },

  // Data store: 'memory' (default, no credentials) or 'firestore'.
  store: process.env.CALL_STORE || 'memory',

  // Provider: 'mock' (default, no credentials, labeled as test) or 'retell'.
  provider: process.env.VOICE_PROVIDER || 'mock',

  retell: {
    apiKey: process.env.RETELL_API_KEY || '',
    baseUrl: process.env.RETELL_BASE_URL || 'https://api.retellai.com',
    agentId: process.env.RETELL_AGENT_ID || '',
    // The verified outbound caller ID / from number provisioned in Retell.
    fromNumber: process.env.RETELL_FROM_NUMBER || '',
    // Webhook signing: Retell signs with the API key; the SDK verify() uses it.
    webhookApiKey: process.env.RETELL_WEBHOOK_API_KEY || process.env.RETELL_API_KEY || '',
  },

  // Editable demo identity + business context injected into the agent as dynamic
  // variables (the "Aria" prompt's {{...}} fields). Defaults are intentionally empty
  // for content fields — the agent must never invent business facts. Fill these via
  // environment variables to give Aria real, verified information to work from.
  demo: {
    businessName: process.env.DEMO_BUSINESS_NAME || 'AutoScale Demo',
    agentName: process.env.DEMO_AGENT_NAME || 'Aria',
    callPurpose:
      process.env.DEMO_CALL_PURPOSE ||
      'a short demonstration of our AI voice assistant',
    businessDescription: process.env.DEMO_BUSINESS_DESCRIPTION || '',
    productDetails: process.env.DEMO_PRODUCT_DETAILS || '',
    businessFaqs: process.env.DEMO_BUSINESS_FAQS || '',
    offersAndPrices: process.env.DEMO_OFFERS_AND_PRICES || '',
    contactDetails: process.env.DEMO_CONTACT_DETAILS || '',
    additionalInstructions: process.env.DEMO_ADDITIONAL_INSTRUCTIONS || '',
  },

  limits: {
    // Max calls per admin per rolling window (rate limit).
    perMinute: num('RATE_LIMIT_PER_MINUTE', 5),
    // Hard daily cap across the whole demo.
    dailyCallLimit: num('DAILY_CALL_LIMIT', 25),
    // Max concurrent in-flight calls.
    maxConcurrent: num('MAX_CONCURRENT_CALLS', 2),
    // Spend ceiling (provider-reported or estimated) in USD for the day.
    maxDailySpendUsd: num('MAX_DAILY_SPEND_USD', 10),
    // Estimated USD/min used ONLY for pre-call spend projection (labeled estimate).
    estimatedUsdPerMinute: num('ESTIMATED_USD_PER_MINUTE', 0.12),
    // Max expected minutes per call for the pre-call spend projection.
    estimatedMinutesPerCall: num('ESTIMATED_MINUTES_PER_CALL', 5),
  },

  retention: {
    // Days to keep transcripts/PII before eligible for deletion.
    days: num('DATA_RETENTION_DAYS', 30),
  },

  corsOrigins: list('CORS_ORIGINS'),
};

// Only +91 (India) destinations are permitted for this demo.
export const ALLOWED_COUNTRY = 'IN';

export function assertProviderConfigured() {
  if (config.provider === 'retell') {
    const missing = [];
    if (!config.retell.apiKey) missing.push('RETELL_API_KEY');
    if (!config.retell.agentId) missing.push('RETELL_AGENT_ID');
    if (!config.retell.fromNumber) missing.push('RETELL_FROM_NUMBER');
    if (missing.length) {
      const err = new Error(
        `Provider 'retell' selected but missing: ${missing.join(', ')}`
      );
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
    }
  }
}

export function isMockProvider() {
  return config.provider !== 'retell';
}
