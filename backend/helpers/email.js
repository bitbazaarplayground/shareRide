import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const BREVO_KEY = process.env.BREVO_API_KEY;
const FROM = process.env.BREVO_FROM || "TabFair <hello@tabfair.com>";

// ✅ Automatically pick frontend URL
const APP_ORIGIN =
  process.env.APP_ORIGIN ||
  (process.env.NODE_ENV === "production"
    ? "https://jade-rolypoly-5d4274.netlify.app"
    : "http://localhost:5173");

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
 * Email Templates (TabFair branded)
 * -------------------------------------------------------- */
export const templates = {
  // 1️⃣ Passenger — after booking a ride
  passengerBooked: ({
    from,
    to,
    date,
    time,
    host,
    amount,
    currency,
    rideId,
  }) => {
    const rideLink = `http://localhost:5173/my-rides${
      rideId ? `#ride-${rideId}` : ""
    }`;

    return {
      subject: "🚗 Thanks for booking your ride on TabFair",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
          <h2 style="color:#0a84ff;margin-bottom:12px;">Your ride booking is confirmed!</h2>
          <p>Thanks for booking your shared ride on <strong>TabFair</strong>. We’ve notified <strong>${host}</strong> to confirm your trip.</p>

          <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
            <div><strong>From:</strong> ${from}</div>
            <div><strong>To:</strong> ${to}</div>
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Time:</strong> ${time}</div>
            <div><strong>Amount paid:</strong> £${amount} ${
        currency || ""
      }</div>
          </div>

          <p style="margin:20px 0;">
            <a href="${rideLink}"
               style="background-color:#0a84ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">
              View Ride
            </a>
          </p>

          <p style="font-size:14px;color:#555;">
            You’ll receive an update once your ride host confirms the trip. 
            You can view or manage all your rides from your account.
          </p>

          <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
          <p style="font-size:13px;color:#777;">
            This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
            © 2025 TabFair Ltd. All rights reserved.
          </p>
        </div>
      `,
      text: `Your ride booking is confirmed!

From: ${from}
To: ${to}
Date: ${date}
Time: ${time}
Amount paid: £${amount} ${currency || ""}
Host: ${host}

View ride: ${rideLink}
You’ll receive an update once your host confirms the trip.`,
    };
  },

  // 2️⃣ Host — notified that a passenger joined
  hostNotified: ({ from, to, date, time, nickname, rideId }) => {
    const rideLink = `http://localhost:5173/my-rides${
      rideId ? `#ride-${rideId}` : ""
    }`;

    return {
      subject: "👋 A passenger joined your ride on TabFair",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
          <h2 style="color:#0a84ff;margin-bottom:12px;">New passenger joined your ride</h2>
          <p><strong>${nickname}</strong> has joined your ride. Please log in to confirm the trip details and secure your spot.</p>

          <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
            <div><strong>From:</strong> ${from}</div>
            <div><strong>To:</strong> ${to}</div>
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Time:</strong> ${time}</div>
          </div>

          <p style="margin:20px 0;">
            <a href="${rideLink}"
               style="background-color:#0a84ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">
              View Ride
            </a>
          </p>

          <p style="font-size:14px;color:#555;">
            Confirming the ride allows your passenger(s) to prepare and proceed with payment.
            Log in anytime to manage your rides.
          </p>

          <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
          <p style="font-size:13px;color:#777;">
            This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
            © 2025 TabFair Ltd. All rights reserved.
          </p>
        </div>
      `,
      text: `${nickname} joined your ride from ${from} to ${to} on ${date} at ${time}.
Please confirm: ${rideLink}`,
    };
  },

  // 3️⃣ Ride confirmed — sent to both passenger & host
  rideConfirmed: ({ from, to, date, time, rideId }) => {
    const rideLink = `http://localhost:5173/my-rides${
      rideId ? `#ride-${rideId}` : ""
    }`;

    return {
      subject: "✅ Your ride is confirmed on TabFair",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
          <h2 style="color:#0a84ff;margin-bottom:12px;">Your ride is confirmed!</h2>
          <p>Your group is ready to go. You can review details or manage this ride from your account.</p>

          <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
            <div><strong>From:</strong> ${from}</div>
            <div><strong>To:</strong> ${to}</div>
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Time:</strong> ${time}</div>
          </div>

          <p style="margin:20px 0;">
            <a href="${rideLink}"
               style="background-color:#0a84ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">
              View Ride
            </a>
          </p>

          <p style="font-size:14px;color:#555;">
            You’ll receive a reminder closer to departure time. 
            Have a safe trip and thank you for sharing your ride with TabFair!
          </p>

          <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
          <p style="font-size:13px;color:#777;">
            This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
            © 2025 TabFair Ltd. All rights reserved.
          </p>
        </div>
      `,
      text: `Your ride from ${from} to ${to} on ${date} at ${time} is confirmed.
View ride: ${rideLink}`,
    };
  },
};

// === Email to passenger ===
//    const html = `
//    <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#111; line-height:1.5;">
//      <h2 style="margin:0 0 12px">✅ Payment confirmed</h2>
//      <p>Thanks for splitting your ride on <strong>TabFair</strong>!</p>
//      <div style="margin:16px 0; padding:12px; border:1px solid #eee; border-radius:10px;">
//        <div><strong>From:</strong> ${fromLoc}</div>
//        <div><strong>To:</strong> ${toLoc}</div>
//        <div><strong>Date:</strong> ${date}</div>
//        <div><strong>Time:</strong> ${time}</div>
//        <div><strong>Ride host:</strong> ${
//          hostProfile?.nickname || "the ride host"
//        }</div>
//        <div><strong>Amount charged:</strong> ${amount} ${currency}</div>
//      </div>
//      <p>We’ll notify you when your group is ready. The booker can then open Uber and complete the booking.</p>
//    </div>
//    <div>
//      <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
//      <p style="font-size:13px;color:#777;">
//        This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
//        © 2025 TabFair Ltd. All rights reserved.
//      </p>
//    </div>
//  `;
