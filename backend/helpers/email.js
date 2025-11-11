import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const BREVO_KEY = process.env.BREVO_API_KEY;
const FROM = process.env.BREVO_FROM || "TabFair <hello@tabfair.com>";

// ✅ Automatically pick frontend URL
export const APP_ORIGIN =
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
    const rideLink = `${APP_ORIGIN.replace(/\/$/, "")}/my-rides${
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
    
          <p style="font-size:15px;color:#333;margin-bottom:10px;">
            <strong>What happens next?</strong><br>
            You’re now waiting for <strong>${host}</strong> to confirm the ride. Once they confirm, the ride will be ready for everyone to proceed.
          </p>
    
          <p style="font-size:14px;color:#555;">
            If your host doesn’t confirm or no other passengers join, your payment will be <strong>automatically refunded in full</strong> — no action needed.
          </p>
    
          <p style="font-size:14px;color:#555;margin-top:12px;">
            You can view or manage all your rides anytime from your account.
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
    
    What happens next:
    You’re waiting for ${host} to confirm the ride. Once they do, the trip will proceed.
    If they don’t confirm or no other passengers join, you’ll be automatically refunded in full.
    
    View your ride: ${rideLink}
    `,
    };
  },

  // 2️⃣ Host — notified that a passenger joined
  hostNotified: ({ from, to, date, time, nickname, rideLink }) => {
    // ✅ Accept prebuilt link from backend, fallback to live domain
    const link = rideLink || `${APP_ORIGIN.replace(/\/$/, "")}/my-rides`;

    return {
      subject: "👋 A passenger joined your ride on TabFair",
      html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
        <h2 style="color:#0a84ff;margin-bottom:12px;">A new passenger joined your ride!</h2>
        <p>
          <strong>${nickname}</strong> just booked a seat on your shared ride. 
          Please <strong>review and confirm the trip</strong> to secure your group and allow the booking to proceed.
        </p>

        <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
        </div>

        <p style="margin:20px 0;">
          <a href="${link}"
             style="background-color:#0a84ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">
            Review & Confirm Ride
          </a>
        </p>

        <p style="font-size:14px;color:#555;">
          Once you confirm, your passenger(s) will be notified and the ride will be marked as active.  
          If you don’t confirm, the booking will expire automatically and the passenger will be refunded in full.
        </p>

        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
        <p style="font-size:13px;color:#777;">
          This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
          © 2025 TabFair Ltd. All rights reserved.
        </p>
      </div>
    `,
      text: `${nickname} just joined your ride.

From: ${from}
To: ${to}
Date: ${date}
Time: ${time}

Please review and confirm the trip to secure your passenger(s):
${link}

Once confirmed, the ride becomes active.
If not confirmed, the booking will expire and the passenger will be refunded in full.
`,
    };
  },

  // 3️⃣ Ride confirmed — sent to both passenger & host
  rideConfirmed: ({ from, to, date, time, rideId }) => {
    const rideLink = `${APP_ORIGIN.replace(/\/$/, "")}/my-rides${
      rideId ? `#ride-${rideId}` : ""
    }`;

    return {
      subject: "✅ Your ride is confirmed on TabFair",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
          <h2 style="color:#0a84ff;margin-bottom:12px;">Your ride is confirmed 🎉</h2>
          <p>
            Great news — your shared ride is now confirmed! Your group is set and ready to go.  
            You can view all ride details, message your host or passengers, and get updates directly in the app or on our website.
          </p>
    
          <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
            <div><strong>From:</strong> ${from}</div>
            <div><strong>To:</strong> ${to}</div>
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Time:</strong> ${time}</div>
          </div>
    
          <p style="margin:20px 0;">
            <a href="${rideLink}"
               style="background-color:#0a84ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">
              View Ride Details
            </a>
          </p>
    
          <p style="font-size:14px;color:#555;">
            You can access this ride anytime from your <strong>TabFair</strong> account — on the web or in the app — to check updates, share with others, or prepare for your trip.
          </p>
    
          <p style="font-size:14px;color:#555;margin-top:8px;">
            We’ll also send you a friendly reminder closer to your departure time.  
            Have a safe and enjoyable journey!
          </p>
    
          <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
          <p style="font-size:13px;color:#777;">
            This email was sent by <strong>TabFair</strong> · hello@tabfair.com<br>
            © 2025 TabFair Ltd. All rights reserved.
          </p>
        </div>
      `,
      text: `Your ride from ${from} to ${to} on ${date} at ${time} is confirmed! 🎉
    
    You can view all details, message your group, and get updates directly in your TabFair account.
    
    View ride details: ${rideLink}
    
    We’ll remind you closer to your departure time.
    Have a safe and enjoyable journey!
    `,
    };
  },
  newHostPromotion: ({ from, to, date, time, rideLink }) => ({
    subject: "👑 You’ve been promoted to ride host on TabFair",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
        <h2 style="color:#e66000;">You’re now the ride host</h2>
        <p>Since the original host didn’t confirm in time, you’ve been automatically promoted as the new ride host.</p>
        <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
        </div>
        <p>
          <a href="${rideLink}" style="background-color:#e66000;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">View Ride</a>
        </p>
        <p style="font-size:14px;color:#555;">You can now manage this ride, confirm details, or cancel if needed. Thank you for keeping the trip on track!</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
        <p style="font-size:13px;color:#777;">Sent by <strong>TabFair</strong> · hello@tabfair.com</p>
      </div>
    `,
    text: `You’ve been promoted to ride host for your trip from ${from} to ${to} on ${date} at ${time}. View your ride: ${rideLink}`,
  }),

  hostAutoPromoted: ({ from, to, date, time, rideLink }) => ({
    subject: "Your ride has been confirmed on TabFair",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:600px;margin:auto;padding:20px;">
        <h2 style="color:#e66000;">Your ride is now confirmed</h2>
        <p>The ride you joined is now confirmed, and a new host has been automatically assigned. Thank you for your patience!</p>
        <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
          <div><strong>Time:</strong> ${time}</div>
        </div>
        <p>
          <a href="${rideLink}" style="background-color:#e66000;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">View Ride</a>
        </p>
        <p style="font-size:14px;color:#555;">You can check ride details and message your new host from your account.</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
        <p style="font-size:13px;color:#777;">Sent by <strong>TabFair</strong> · hello@tabfair.com</p>
      </div>
    `,
    text: `Your ride from ${from} to ${to} on ${date} at ${time} is confirmed with a new host. View your ride: ${rideLink}`,
  }),
};
