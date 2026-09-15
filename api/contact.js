export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { schoolName, contactPerson, phone, email, studentCount, message } = req.body || {};

  if (!schoolName || !contactPerson || !email) {
    return res.status(400).json({ error: "Please fill in school name, contact person, and email." });
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
          <p><strong>School name:</strong> ${schoolName}</p>
          <p><strong>Contact person:</strong> ${contactPerson}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Number of students (approx):</strong> ${studentCount || "Not provided"}</p>
          <p><strong>Message:</strong></p>
          <p>${(message || "").replace(/\n/g, "<br>")}</p>
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