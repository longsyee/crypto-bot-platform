import nodemailer from "nodemailer";
import { config } from "../config";

const hasSmtp = config.SMTP_HOST.length > 0;

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    })
  : null;

function devLog(subject: string, to: string, body: string) {
  console.log("\n========== EMAIL DEV FALLBACK ==========");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log("========================================\n");
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = "Your Verification Code";
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#0f1117;color:#f8fafc;border-radius:12px;border:1px solid #1e293b;">
      <h2 style="margin-top:0;color:#60a5fa;">Verify Your Email</h2>
      <p style="color:#94a3b8;">Use the code below to complete your registration.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px 0;color:#fff;background:#13161f;border-radius:8px;border:1px solid #1e293b;margin:16px 0;">${otp}</div>
      <p style="color:#64748b;font-size:12px;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({ from: config.SMTP_FROM, to, subject, html });
  } else {
    devLog(subject, to, `OTP: ${otp}`);
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const subject = "Password Reset Request";
  const resetUrl = `${process.env.WEB_URL || "http://localhost:4174"}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#0f1117;color:#f8fafc;border-radius:12px;border:1px solid #1e293b;">
      <h2 style="margin-top:0;color:#60a5fa;">Reset Your Password</h2>
      <p style="color:#94a3b8;">Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0;">Reset Password</a>
      <p style="color:#64748b;font-size:12px;">If you did not request this, ignore this email.</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({ from: config.SMTP_FROM, to, subject, html });
  } else {
    devLog(subject, to, `Reset URL: ${resetUrl}`);
  }
}
