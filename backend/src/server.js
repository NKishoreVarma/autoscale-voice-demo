import { createApp } from './app.js';
import { config, isMockProvider } from './config.js';
import { logger } from './lib/logger.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info('server.started', {
    port: config.port,
    env: config.env,
    provider: config.provider,
    mode: isMockProvider() ? 'test' : 'live',
    store: config.store,
  });
  if (isMockProvider()) {
    logger.warn('server.mock_mode', {
      note: 'MOCK provider active — no real phone calls will be placed.',
    });
  }
});
