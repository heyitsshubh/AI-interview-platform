/**
 * Email Service — SMTP-based email sending using Nodemailer.
 * Sends beautiful HTML emails for interview notifications.
 */
import nodemailer from 'nodemailer';

// ─── SMTP Transporter ─────────────────────────────────────────────────────────

const smtpPort = parseInt(process.env.SMTP_PORT || '587');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,  // true for SSL, false for TLS/STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
});

// Verify SMTP connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('[Email] SMTP connection failed:', error.message);
  } else {
    console.log('[Email] SMTP server ready to send emails');
  }
});

const FROM_NAME = process.env.SMTP_FROM_NAME || 'AI Interview Platform';
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@ai-interview.com';
const FROM = `"${FROM_NAME}" <${FROM_EMAIL}>`;

// ─── HTML Templates ───────────────────────────────────────────────────────────

function baseLayout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">🎯</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">AI Interview Platform</h1>
              <p style="color:#8892b0;margin:8px 0 0;font-size:14px;">${title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#1a1a2e;padding:32px;border-left:1px solid #2d2d4e;border-right:1px solid #2d2d4e;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#12122a;border-radius:0 0 12px 12px;padding:20px;text-align:center;border:1px solid #2d2d4e;border-top:none;">
              <p style="color:#4a4a6a;font-size:12px;margin:0;">
                This is an automated message from AI Interview Platform.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function scoreBar(label, score, maxScore = 10) {
  const pct = Math.round((score / maxScore) * 100);
  const color = pct >= 70 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c';
  return `
  <div style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="color:#ccd6f6;font-size:13px;">${label}</span>
      <span style="color:${color};font-size:13px;font-weight:700;">${score.toFixed(1)}/10</span>
    </div>
    <div style="background:#2d2d4e;border-radius:100px;height:8px;overflow:hidden;">
      <div style="background:${color};width:${pct}%;height:8px;border-radius:100px;"></div>
    </div>
  </div>`;
}

function recommendationBadge(recommendation) {
  const config = {
    STRONG_HIRE: { bg: '#0d3d2d', color: '#2ecc71', text: '✅ STRONG HIRE' },
    HIRE: { bg: '#0d3d2d', color: '#2ecc71', text: '✅ HIRE' },
    MAYBE: { bg: '#3d2d0d', color: '#f39c12', text: '⚠️ MAYBE' },
    REJECT: { bg: '#3d0d0d', color: '#e74c3c', text: '❌ REJECT' },
  };
  const { bg, color, text } = config[recommendation] || config.MAYBE;
  return `
  <div style="background:${bg};border:1px solid ${color};border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
    <span style="color:${color};font-size:18px;font-weight:700;">${text}</span>
  </div>`;
}

// ─── Email Service ────────────────────────────────────────────────────────────

export const EmailService = {
  /**
   * Send a base email with HTML content.
   */
  async sendEmail(to, subject, html) {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
    });
    console.log(`[Email] ✅ Sent to ${to}: ${info.messageId}`);
    return info;
  },

  /**
   * Interview completed — send results summary.
   */
  async sendInterviewCompleted(to, candidateName, jobTitle, overallScore, recommendation, hasCheating) {
    const cheatingWarning = hasCheating
      ? `<div style="background:#3d0d0d;border:1px solid #e74c3c;border-radius:8px;padding:16px;margin:16px 0;">
           <p style="color:#e74c3c;margin:0;font-weight:700;">⚠️ Integrity Concerns Detected</p>
           <p style="color:#c0392b;margin:8px 0 0;font-size:14px;">
             Our monitoring system detected potential integrity violations during your session. 
             These have been recorded and will be reviewed.
           </p>
         </div>`
      : '';

    const body = `
      <p style="color:#8892b0;font-size:14px;margin:0 0 24px;">Hello <strong style="color:#ccd6f6;">${candidateName}</strong>,</p>
      
      <p style="color:#ccd6f6;font-size:16px;margin:0 0 24px;">
        Your interview for the <strong style="color:#64ffda;">${jobTitle}</strong> position has been completed and evaluated!
      </p>

      <div style="background:#12122a;border-radius:8px;padding:20px;margin:0 0 20px;">
        <h3 style="color:#ccd6f6;margin:0 0 16px;font-size:16px;">📊 Your Score Summary</h3>
        ${scoreBar('Overall Score', overallScore)}
      </div>

      ${recommendationBadge(recommendation)}
      ${cheatingWarning}

      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.FRONTEND_URL || '#'}/dashboard/reports" 
           style="background:linear-gradient(135deg,#e94560,#c0392b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
          📄 View Full Report
        </a>
      </div>

      <p style="color:#8892b0;font-size:13px;margin:24px 0 0;">
        Your detailed PDF report is now available in your dashboard.
      </p>`;

    await this.sendEmail(
      to,
      `🎯 Interview Results: ${jobTitle} Position`,
      baseLayout('Interview Results', body)
    );
  },

  /**
   * Resume successfully processed.
   */
  async sendResumeProcessed(to, candidateName) {
    const body = `
      <p style="color:#8892b0;font-size:14px;margin:0 0 24px;">Hello <strong style="color:#ccd6f6;">${candidateName}</strong>,</p>

      <div style="background:#0d3d2d;border:1px solid #2ecc71;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">✅</div>
        <h3 style="color:#2ecc71;margin:0;font-size:18px;">Resume Processed Successfully!</h3>
      </div>

      <p style="color:#ccd6f6;font-size:15px;margin:0 0 16px;">
        Your resume has been analyzed and is ready for AI-powered interviews. Here's what we did:
      </p>

      <ul style="color:#8892b0;font-size:14px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
        <li>✅ Extracted and analyzed your resume content</li>
        <li>✅ Generated semantic embeddings for intelligent matching</li>
        <li>✅ Created your personalized knowledge profile</li>
      </ul>

      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.FRONTEND_URL || '#'}/dashboard/interviews/new"
           style="background:linear-gradient(135deg,#64ffda,#00b894);color:#0f0f1a;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
          🎤 Start Your Interview
        </a>
      </div>`;

    await this.sendEmail(
      to,
      '📄 Your Resume is Ready for Interviews',
      baseLayout('Resume Processed', body)
    );
  },

  /**
   * Interview reminder notification.
   */
  async sendInterviewReminder(to, candidateName, jobTitle, scheduledAt) {
    const formattedDate = new Date(scheduledAt).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const body = `
      <p style="color:#8892b0;font-size:14px;margin:0 0 24px;">Hello <strong style="color:#ccd6f6;">${candidateName}</strong>,</p>

      <div style="background:#1e2a4a;border:1px solid #64ffda;border-radius:8px;padding:20px;margin:0 0 24px;">
        <h3 style="color:#64ffda;margin:0 0 8px;">⏰ Interview Reminder</h3>
        <p style="color:#ccd6f6;margin:0;font-size:15px;">
          Position: <strong>${jobTitle}</strong><br>
          Scheduled: <strong>${formattedDate}</strong>
        </p>
      </div>

      <p style="color:#8892b0;font-size:14px;margin:0 0 16px;">Tips to ace your interview:</p>
      <ul style="color:#ccd6f6;font-size:14px;line-height:2;margin:0 0 24px;padding-left:20px;">
        <li>🎤 Ensure your microphone is working properly</li>
        <li>💡 Find a quiet, well-lit location</li>
        <li>📋 Review the job description beforehand</li>
        <li>🧘 Stay calm and answer clearly</li>
      </ul>

      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.FRONTEND_URL || '#'}/dashboard/interviews"
           style="background:linear-gradient(135deg,#e94560,#c0392b);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
          🚀 Go to Interview
        </a>
      </div>`;

    await this.sendEmail(
      to,
      `⏰ Reminder: Your ${jobTitle} Interview`,
      baseLayout('Interview Reminder', body)
    );
  },
};

export default EmailService;
