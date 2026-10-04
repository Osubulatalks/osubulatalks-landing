const ALLOWED_HOSTNAMES = ["osubulatalks.com", "www.osubulatalks.com"];

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clip(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function clipLine(value, max) {
  return clip(value, max).replace(/[\r\n]+/g, " ");
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set");
    return false;
  }
  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (ip) params.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
    const result = await r.json();
    if (!result.success) {
      console.error("Turnstile rejected token:", JSON.stringify(result["error-codes"] || []));
      return false;
    }
    if (result.hostname && !ALLOWED_HOSTNAMES.includes(result.hostname)) {
      console.error("Turnstile hostname mismatch:", result.hostname);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};

  const token = body["cf-turnstile-response"];
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Please complete the verification check, then press Send again." });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const human = await verifyTurnstile(token, ip);
  if (!human) {
    return res.status(400).json({ error: "Verification failed. Please refresh the page and try again, or use WhatsApp." });
  }

  const schoolName = clipLine(body.schoolName, 200);
  const contactPerson = clipLine(body.contactPerson, 200);
  const phone = clipLine(body.phone, 50);
  const email = clipLine(body.email, 200);
  const studentCount = clipLine(body.studentCount, 50);
  const message = clip(body.message, 2000);

  if (!schoolName || !contactPerson || !email) {
    return res.status(400).json({ error: "Please fill in school name, contact person, and email." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Osubulatalks Solutions <noreply@osubulatalks.com>",
        to: ["osubuladan@gmail.com"],
        reply_to: email,
        subject: `New school signup interest: ${schoolName}`,
        html: `
          <p><strong>School name:</strong> ${escapeHtml(schoolName)}</p>
          <p><strong>Contact person:</strong> ${escapeHtml(contactPerson)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone) || "Not provided"}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Number of students (approx):</strong> ${escapeHtml(studentCount) || "Not provided"}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", errBody);
      return res.status(502).json({ error: "Could not send the message. Try again shortly." });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return res.status(500).json({ error: "Something went wrong. Try again shortly." });
  }
}