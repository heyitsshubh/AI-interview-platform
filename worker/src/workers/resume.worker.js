/**
 * Resume Processing Worker
 * Queue: resume-processing
 * Job: PROCESS_RESUME
 *
 * Flow:
 *   1. Update status → PROCESSING
 *   2. Trigger PDF text extraction via FastAPI
 *   3. Trigger FAISS embedding generation via FastAPI
 *   4. Update status → DONE
 *   5. Enqueue email notification
 */
import { Worker } from 'bullmq';
import connection from '../queues/redis.js';
import ApiService from '../services/api.service.js';
import { addEmailJob } from '../queues/interview.queue.js';

const QUEUE_NAME = 'resume-processing';
const CONCURRENCY = 3;

export const resumeWorker = new Worker(
  QUEUE_NAME,

  async (job) => {
    const { resume_id, file_path, user_id } = job.data;

    console.log(`[resume-worker] 🔄 Processing job ${job.id} | resume: ${resume_id}`);

    try {
      // Step 1: Mark as PROCESSING
      await job.updateProgress(10);
      await ApiService.updateResumeStatus(resume_id, 'PROCESSING');
      console.log(`[resume-worker] Status → PROCESSING`);

      // Step 2: Extract text from PDF
      await job.updateProgress(30);
      console.log(`[resume-worker] Extracting text from: ${file_path}`);
      const extractResult = await ApiService.extractResumeText(resume_id);
      console.log(`[resume-worker] Extracted ${extractResult.text_length || 0} characters`);

      // Step 3: Generate FAISS embeddings
      await job.updateProgress(60);
      console.log(`[resume-worker] Generating embeddings for user: ${user_id}`);
      const embedResult = await ApiService.generateResumeEmbeddings(resume_id);
      console.log(`[resume-worker] Embeddings saved to: ${embedResult.embedding_path}`);

      // Step 4: Mark as DONE
      await job.updateProgress(90);
      await ApiService.updateResumeStatus(resume_id, 'DONE', null, embedResult.embedding_path);
      console.log(`[resume-worker] Status → DONE`);

      // Step 5: Send email notification
      await job.updateProgress(95);
      try {
        const userInfo = await ApiService.getUserEmail(user_id);
        await addEmailJob(
          userInfo.email,
          'Your Resume is Ready',
          'RESUME_PROCESSED',
          { candidate_name: userInfo.full_name }
        );
        console.log(`[resume-worker] Email notification queued for: ${userInfo.email}`);
      } catch (emailErr) {
        // Non-fatal: log but don't fail the job
        console.warn(`[resume-worker] Email notification failed: ${emailErr.message}`);
      }

      await job.updateProgress(100);
      console.log(`[resume-worker] ✅ Job ${job.id} completed successfully`);
      return { resume_id, status: 'DONE' };

    } catch (error) {
      console.error(`[resume-worker] ❌ Job ${job.id} failed: ${error.message}`);

      // Mark resume as FAILED
      try {
        await ApiService.updateResumeStatus(resume_id, 'FAILED');
      } catch (updateErr) {
        console.error(`[resume-worker] Failed to update status to FAILED: ${updateErr.message}`);
      }

      throw error; // Re-throw for BullMQ retry mechanism
    }
  },

  {
    connection,
    concurrency: CONCURRENCY,
    stalledInterval: 30000,
    maxStalledCount: 1,
  }
);

// Worker event handlers
resumeWorker.on('completed', (job, result) => {
  console.log(`[resume-worker] ✅ Job ${job.id} done:`, result);
});

resumeWorker.on('failed', (job, err) => {
  console.error(`[resume-worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`);
});

resumeWorker.on('stalled', (jobId) => {
  console.warn(`[resume-worker] ⚠️  Job ${jobId} stalled`);
});

resumeWorker.on('error', (err) => {
  console.error('[resume-worker] Worker error:', err);
});

console.log(`[resume-worker] 🚀 Listening on queue: ${QUEUE_NAME} (concurrency: ${CONCURRENCY})`);

export default resumeWorker;
