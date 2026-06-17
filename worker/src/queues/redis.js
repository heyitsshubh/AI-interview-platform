/**
 * Shared Redis connection for all BullMQ workers and queues.
 * Uses ioredis with maxRetriesPerRequest: null (required by BullMQ).
 * Upstash requires port 6380 with TLS.
 */
import IORedis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const useTls = redisHost.includes('upstash.io') || redisPort === 6380;

console.log(`[Redis] Connecting to ${redisHost}:${redisPort} | TLS: ${useTls}`);

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  tls: useTls
    ? {
        rejectUnauthorized: false,  // Required for Upstash on Render
      }
    : undefined,
  maxRetriesPerRequest: null,   // Required for BullMQ blocking operations
  enableReadyCheck: false,
  connectTimeout: 20000,        // 20s timeout (Upstash can be slow to connect)
  lazyConnect: false,
  keepAlive: 30000,             // Keep TCP alive every 30s
  retryStrategy: (times) => {
    if (times > 20) {
      console.error('[Redis] Max retries reached. Giving up.');
      return null;              // Stop retrying after 20 attempts
    }
    const delay = Math.min(times * 500, 5000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

connection.on('connect', () => {
  console.log(`[Redis] ✅ Connected to ${redisHost}:${redisPort} (TLS: ${useTls})`);
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
