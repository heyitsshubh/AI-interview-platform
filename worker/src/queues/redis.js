/**
 * Shared Redis connection for all BullMQ workers and queues.
 * Uses ioredis with maxRetriesPerRequest: null (required by BullMQ).
 */
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,  // Required for BullMQ blocking operations
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 500, 5000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

connection.on('connect', () => {
  console.log(`[Redis] Connected to ${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`);
});

connection.on('ready', () => {
  console.log('[Redis] Ready to accept commands');
});

connection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

connection.on('close', () => {
  console.warn('[Redis] Connection closed');
});

export default connection;
