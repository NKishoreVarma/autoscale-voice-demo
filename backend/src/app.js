// Express app factory. Exported separately from server.js so tests can import the
// app without binding a port.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { callsRouter } from './routes/calls.js';
import webhooksRouter from './routes/webhooks.js';
import { statusRouter } from './routes/status.js';
import { logger } from './lib/logger.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    })
  );

  // Health check (no auth).
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Webhooks mounted BEFORE the JSON body parser — they need the raw body for
  // signature verification.
  app.use('/api/webhooks', webhooksRouter);

  // JSON parsing for the rest.
  app.use(express.json({ limit: '256kb' }));

  app.use('/api/status', statusRouter);
  app.use('/api/voice/calls', callsRouter);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  // Centralized error handler — never leak internals.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('unhandled.error', { message: err.message });
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
