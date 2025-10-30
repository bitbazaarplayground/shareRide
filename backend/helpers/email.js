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

/* --------------------------------------------------------
 * Email Templates
 * -------------------------------------------------------- */
export const templates = {
  passengerBooked: ({ from, to, date, time, host, amount, currency }) => ({
    subject: "Thanks for booking your ride on TabFair",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
        <h2>Thanks for booking your ride!</h2>
        <p>We're waiting for <strong>${host}</strong> to confirm the ride.</p>
        <div style="margin:16px 0;padding:12px;border:1px solid #eee;border-radius:10px;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
          <div><strong>Amount:</strong> £${amount} ${currency || ""}</div>
        </div>
      </div>`,
    text: `Thanks for booking your ride from ${from} to ${to} on ${date} at ${time}. Waiting for ${host} to confirm.`,
  }),

  hostNotified: ({ from, to, date, time, passenger }) => ({
    subject: " A passenger joined your ride",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
        <h2>New passenger joined!</h2>
        <p>${passenger} has joined your ride. Please confirm to continue.</p>
        <div style="margin:16px 0;padding:12px;border:1px solid #eee;border-radius:10px;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
        </div>
      </div>`,
    text: `${passenger} joined your ride from ${from} to ${to}.`,
  }),

  rideConfirmed: ({ from, to, date, time }) => ({
    subject: "Your ride is confirmed!",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
        <h2>Your ride is confirmed!</h2>
        <p>Your group is ready to go.</p>
        <div style="margin:16px 0;padding:12px;border:1px solid #eee;border-radius:10px;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
        </div>
      </div>`,
    text: `Your ride from ${from} to ${to} on ${date} at ${time} is confirmed.`,
  }),
};
