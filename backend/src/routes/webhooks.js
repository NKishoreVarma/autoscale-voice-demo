import express from 'express';
import { getProvider } from '../providers/index.js';
import { processWebhook } from '../services/webhookService.js';
import { logger } from '../lib/logger.js';

export const webhooksRouter = express.Router();

// POST /api/webhooks/retell — provider status/transcript callbacks.
// Mounted with a RAW body parser so the signature is verified over exact bytes.
webhooksRouter.post('/retell', express.raw({ type: '*/*' }), async (req, res) => {
  const provider = getProvider();
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';
  const signature =
    req.get('x-retell-signature') || req.get('x-webhook-signature') || '';

  // 1. Verify signature BEFORE trusting anything in the payload.
  if (!provider.verifyWebhook({ rawBody, signature })) {
    logger.warn('webhook.invalid_signature');
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON.' });
  }

  try {
    const result = await processWebhook(body);
    // Always 200 for accepted/deduped/unknown so the provider stops retrying a
    // well-formed, authenticated event; 200 does not imply a record changed.
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    logger.error('webhook.process.error', { message: err.message });
    // 500 lets the provider retry on genuine processing failures.
    return res.status(500).json({ error: 'Processing error.' });
  }
});

export { webhooksRouter as default };
