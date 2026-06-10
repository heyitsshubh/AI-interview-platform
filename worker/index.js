/**
 * Worker Service Bootstrap
 * Starts all BullMQ workers and handles graceful shutdown.
 */
import 'dotenv/config';

console.log('🚀 AI Interview Platform — Worker Service Starting...');
console.log(`📡 Redis: ${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
console.log(`🔗 API: ${process.env.API_BASE_URL || 'http://backend:8000'}`);

// Import workers (starts them automatically on import)
import { resumeWorker } from './src/workers/resume.worker.js';
import { evaluationWorker } from './src/workers/evaluation.worker.js';
import { reportWorker } from './src/workers/report.worker.js';

// Import queues for cleanup
import { closeAllQueues } from './src/queues/interview.queue.js';
import connection from './src/queues/redis.js';

const workers = [resumeWorker, evaluationWorker, reportWorker];

console.log('');
console.log('✅ Workers running:');
console.log('   📄 resume-processing  (concurrency: 3)');
console.log('   📊 generate-report    (concurrency: 2)');
console.log('   📧 send-email         (concurrency: 5)');
console.log('');
console.log('Waiting for jobs... Press Ctrl+C to stop.\n');

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}. Starting graceful shutdown...`);

  // Close all workers (stop accepting new jobs)
  const closePromises = workers.map(async (worker) => {
    try {
      await worker.close();
      console.log(`[shutdown] Worker '${worker.name}' closed`);
    } catch (err) {
      console.error(`[shutdown] Error closing worker '${worker.name}': ${err.message}`);
    }
  });

  await Promise.allSettled(closePromises);

  // Close queues
  try {
    await closeAllQueues();
    console.log('[shutdown] All queues closed');
  } catch (err) {
    console.error('[shutdown] Error closing queues:', err.message);
  }

  // Close Redis connection
  try {
    await connection.quit();
    console.log('[shutdown] Redis connection closed');
  } catch (err) {
    console.error('[shutdown] Error closing Redis:', err.message);
  }

  console.log('[shutdown] ✅ Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Global Error Handlers ────────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  console.error('[global] Unhandled Promise Rejection:', reason);
  // Don't exit — workers should continue running
});

process.on('uncaughtException', (err) => {
  console.error('[global] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Exit on uncaught exceptions (PM2/Docker will restart)
  process.exit(1);
});
