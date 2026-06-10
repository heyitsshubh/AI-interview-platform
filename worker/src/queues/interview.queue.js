/**
 * BullMQ Queue definitions.
 * Three queues:
 *   - resume-processing : PDF text extraction + embedding
 *   - generate-report   : AI evaluation + PDF report creation
 *   - send-email        : SMTP email notifications
 */
import { Queue, QueueEvents } from 'bullmq';
import connection from './redis.js';

// ─── Queue Instances ──────────────────────────────────────────────────────────

export const resumeProcessingQueue = new Queue('resume-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const generateReportQueue = new Queue('generate-report', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const sendEmailQueue = new Queue('send-email', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

// ─── Queue Event Listeners ────────────────────────────────────────────────────

function attachQueueEvents(queueName) {
  const events = new QueueEvents(queueName, { connection });

  events.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[${queueName}] ✅ Job ${jobId} completed`);
  });

  events.on('failed', ({ jobId, failedReason }) => {
    console.error(`[${queueName}] ❌ Job ${jobId} failed: ${failedReason}`);
  });

  events.on('stalled', ({ jobId }) => {
    console.warn(`[${queueName}] ⚠️  Job ${jobId} stalled`);
  });

  events.on('progress', ({ jobId, data }) => {
    console.log(`[${queueName}] 📊 Job ${jobId} progress: ${JSON.stringify(data)}`);
  });

  return events;
}

export const resumeQueueEvents = attachQueueEvents('resume-processing');
export const reportQueueEvents = attachQueueEvents('generate-report');
export const emailQueueEvents = attachQueueEvents('send-email');

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function addEmailJob(to, subject, template, context) {
  const job = await sendEmailQueue.add('SEND_EMAIL', { to, subject, template, context });
  console.log(`[send-email] Job ${job.id} queued for: ${to}`);
  return job.id;
}

export async function closeAllQueues() {
  await resumeProcessingQueue.close();
  await generateReportQueue.close();
  await sendEmailQueue.close();
}
