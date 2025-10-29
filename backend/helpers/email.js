// backend/helpers/email.js
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const BREVO_KEY = process.env.BREVO_API_KEY;
const FROM = process.env.BREVO_FROM || "TabFair <hello@tabfair.com>";

/**
 * Send an email via Brevo (HTTP API)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {string} [text] - Optional plain text fallback
 */
export async function sendEmail(to, subject, html, text = "") {
  if (!BREVO_KEY) {
    console.warn("⚠️ Brevo API key not set. Email skipped.");
    return null;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "TabFair", email: FROM.match(/<(.+)>/)?.[1] || FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Email send failed:", response.status, errorText);
      throw new Error(`Brevo API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("📧 Brevo email sent:", data.messageId || data);
    return data;
  } catch (err) {
    console.error("💥 Email send failed:", err.message);
    throw err;
  }
}
