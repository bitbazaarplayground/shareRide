// backend/helpers/email.js
import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config({ path: "./backend/.env" });

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_API_KEY,
  },
});

const FROM = process.env.BREVO_FROM || "TabFair <support@tabfair.com>";

/**
 * Send an email via Brevo (SMTP)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {string} [text] - Optional plain text fallback
 */
export async function sendEmail(to, subject, html, text = "") {
  if (!process.env.BREVO_API_KEY) {
    console.warn("⚠️ Brevo API key not set. Email skipped.");
    return null;
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text,
    });
    console.log("📧 Email sent successfully:", info.messageId || info.response);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    throw err;
  }
}
