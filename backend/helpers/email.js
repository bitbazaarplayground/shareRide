// helpers/email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || "TabFair <onboarding@resend.dev>";

/**
 * Send an email via Resend
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {string} [text] - Optional plain text fallback
 */
export async function sendEmail(to, subject, html, text = "") {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ Resend API key not set. Email skipped.");
    return null;
  }

  try {
    const response = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
    });
    console.log("📧 Email queued:", response?.id || response);
    return response;
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    throw err;
  }
}
