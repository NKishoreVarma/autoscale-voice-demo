// Retention/deletion job. Deletes call records older than DATA_RETENTION_DAYS.
// Run manually or via cron: `node src/scripts/retention.js`.
import { config } from '../config.js';
import { getStore } from '../store/index.js';
import { logger } from '../lib/logger.js';

export async function runRetention(now = Date.now()) {
  const store = await getStore();
  const cutoff = now - config.retention.days * 24 * 60 * 60 * 1000;
  const removed = await store.deleteExpired(cutoff);
  logger.info('retention.run', { removed, cutoff, retentionDays: config.retention.days });
  return removed;
}

// Executed directly (not imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  runRetention()
    .then((n) => {
      process.stdout.write(`Retention complete. Removed ${n} record(s).\n`);
      process.exit(0);
    })
    .catch((e) => {
      process.stderr.write(`Retention failed: ${e.message}\n`);
      process.exit(1);
    });
}
