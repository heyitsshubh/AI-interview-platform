/**
 * Evaluation Worker
 * Queue: generate-report
 * Job: GENERATE_REPORT
 *
 * Flow:
 *   1. Fetch interview data (questions + answers)
 *   2. Get cheating report
 *   3. Run AI evaluation pipeline via FastAPI
 *   4. Queue completion email notification
 */
import { Worker } from 'bullmq';
import connection from '../queues/redis.js';
import ApiService from '../services/api.service.js';
import { addEmailJob } from '../queues/interview.queue.js';

const QUEUE_NAME = 'generate-report';
const CONCURRENCY = 2;

export const evaluationWorker = new Worker(
  QUEUE_NAME,

  async (job) => {
    const { interview_id } = job.data;

    console.log(`[eval-worker] 🔄 Processing job ${job.id} | interview: ${interview_id}`);

    try {
      // Step 1: Fetch interview data
      await job.updateProgress(10);
      console.log(`[eval-worker] Fetching interview data for: ${interview_id}`);
      const interviewData = await ApiService.getInterviewData(interview_id);
      console.log(
        `[eval-worker] Got ${interviewData.questions?.length || 0} questions, ` +
        `${interviewData.answers?.length || 0} answers`
      );

      // Step 2: Get cheating report
      await job.updateProgress(20);
      let cheatingReport = {};
      try {
        cheatingReport = await ApiService.getCheatingReport(interview_id);
        console.log(
          `[eval-worker] Cheating report: ${cheatingReport.total_events || 0} events, ` +
          `integrity: ${cheatingReport.integrity_score || 100}%`
        );
      } catch (cheatingErr) {
        console.warn(`[eval-worker] Could not fetch cheating report: ${cheatingErr.message}`);
      }

      // Step 3: Run AI evaluation pipeline
      await job.updateProgress(30);
      console.log(`[eval-worker] Running AI evaluation pipeline...`);
      const evaluationResult = await ApiService.runEvaluationPipeline(interview_id);
      console.log(
        `[eval-worker] Evaluation complete: score=${evaluationResult.overall_score}, ` +
        `recommendation=${evaluationResult.recommendation}`
      );

      await job.updateProgress(90);

      // Step 4: Send completion email
      if (interviewData.user_id) {
        try {
          const userInfo = await ApiService.getUserEmail(interviewData.user_id);
          const hasCheating = (cheatingReport.total_events || 0) > 0;

          await addEmailJob(
            userInfo.email,
            `Interview Results: ${interviewData.job_title}`,
            'INTERVIEW_COMPLETED',
            {
              candidate_name: userInfo.full_name,
              job_title: interviewData.job_title,
              overall_score: evaluationResult.overall_score || 0,
              recommendation: evaluationResult.recommendation || 'MAYBE',
              report_url: `${process.env.FRONTEND_URL || ''}/dashboard/reports/${interview_id}`,
              cheating_detected: hasCheating,
            }
          );
          console.log(`[eval-worker] Email notification queued for: ${userInfo.email}`);
        } catch (emailErr) {
          console.warn(`[eval-worker] Email notification failed: ${emailErr.message}`);
        }
      }

      await job.updateProgress(100);
      console.log(`[eval-worker] ✅ Job ${job.id} completed`);

      return {
        interview_id,
        overall_score: evaluationResult.overall_score,
        recommendation: evaluationResult.recommendation,
        report_path: evaluationResult.report_path,
      };

    } catch (error) {
      console.error(`[eval-worker] ❌ Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  },

  {
    connection,
    concurrency: CONCURRENCY,
    stalledInterval: 60000,
    maxStalledCount: 1,
  }
);

evaluationWorker.on('completed', (job, result) => {
  console.log(`[eval-worker] ✅ Job ${job.id} done:`, result);
});

evaluationWorker.on('failed', (job, err) => {
  console.error(`[eval-worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
});

evaluationWorker.on('error', (err) => {
  console.error('[eval-worker] Worker error:', err);
});

console.log(`[eval-worker] 🚀 Listening on queue: ${QUEUE_NAME} (concurrency: ${CONCURRENCY})`);

export default evaluationWorker;
