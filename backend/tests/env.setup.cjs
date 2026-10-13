// Runs before any test module is imported, so config.js reads these values.
process.env.NODE_ENV = 'test';
process.env.ADMIN_ALLOWLIST = 'admin@example.com';
process.env.VOICE_PROVIDER = 'mock';
process.env.CALL_STORE = 'memory';
process.env.DAILY_CALL_LIMIT = '25';
process.env.MAX_CONCURRENT_CALLS = '2';
process.env.MAX_DAILY_SPEND_USD = '10';
process.env.RATE_LIMIT_PER_MINUTE = '100'; // high so functional tests aren't throttled
