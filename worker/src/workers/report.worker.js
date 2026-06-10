/**
 * Email Notification Worker
 * Queue: send-email
 * Job: SEND_EMAIL
 *
 * Supported templates:
 *   - INTERVIEW_COMPLETED
 *   - RESUME_PROCESSED
 *   - INTERVIEW_REMINDER
 */
import { Worker } from 'bullmq';
import connection from '../queues/redis.js';
import EmailService from '../services/email.service.js';

const QUEUE_NAME = 'send-email';
const CONCURRENCY = 5;

export const reportWorker = new Worker(
  QUEUE_NAME,

  async (job) => {
    const { to, subject, template, context } = job.data;

    console.log(`[email-worker] 📧 Processing job ${job.id} | to: ${to} | template: ${template}`);

    if (!to || !template) {
      throw new Error('Missing required fields: to, template');
    }

    try {
      switch (template) {
        case 'INTERVIEW_COMPLETED':
          await EmailService.sendInterviewCompleted(
            to,
            context.candidate_name || 'Candidate',
            context.job_title || 'Software Engineer',
            context.overall_score || 0,
            context.recommendation || 'MAYBE',
            context.cheating_detected || false
          );
          break;

        case 'RESUME_PROCESSED':
          await EmailService.sendResumeProcessed(
            to,
            context.candidate_name || 'Candidate'
          );
          break;

        case 'INTERVIEW_REMINDER':
          await EmailService.sendInterviewReminder(
            to,
            context.candidate_name || 'Candidate',
            context.job_title || 'Software Engineer',
            context.scheduled_at || new Date().toISOString()
          );
          break;

        default:
          // Generic email with subject + context
          if (subject && context.html) {
            await EmailService.sendEmail(to, subject, context.html);
          } else {
            console.warn(`[email-worker] Unknown template: ${template}. Skipping.`);
          }
      }

      console.log(`[email-worker] ✅ Email sent to ${to} using template: ${template}`);
      return { to, template, status: 'sent' };

    } catch (error) {
      console.error(`[email-worker] ❌ Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  },

  {
    connection,
    concurrency: CONCURRENCY,
    stalledInterval: 30000,
  }
);

reportWorker.on('completed', (job, result) => {
  console.log(`[email-worker] ✅ Job ${job.id} done:`, result);
});

reportWorker.on('failed', (job, err) => {
  console.error(`[email-worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
});

reportWorker.on('error', (err) => {
  console.error('[email-worker] Worker error:', err);
});

console.log(`[email-worker] 🚀 Listening on queue: ${QUEUE_NAME} (concurrency: ${CONCURRENCY})`);

export default reportWorker;
