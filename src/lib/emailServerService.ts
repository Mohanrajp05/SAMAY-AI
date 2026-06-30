import nodemailer from "nodemailer";

/**
 * Reusable backend service to send emails via SMTP or fall back to simulated console logs.
 * 
 * @param toEmail - The recipient's email address
 * @param subject - The subject of the email
 * @param htmlContent - The HTML body content of the email
 * @returns Promise<{ success: boolean; message: string; simulated: boolean }>
 */
export async function sendEmailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; message: string; simulated: boolean }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "alerts@samayai.com";

  if (!toEmail || toEmail.trim() === "") {
    return {
      success: false,
      message: "Recipient email is missing or empty.",
      simulated: false,
    };
  }

  // Check if SMTP is configured
  if (host && host !== "" && user && user !== "" && pass && pass !== "") {
    try {
      console.log(`[Email Service] Attempting real SMTP email delivery to ${toEmail} via ${host}:${port}...`);
      
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      const mailOptions = {
        from: `"Samay AI Chief of Staff" <${from}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Service] Real email successfully sent to ${toEmail}. Message ID: ${info.messageId}`);
      
      return {
        success: true,
        message: `Email dispatched successfully to ${toEmail}. (SMTP Message ID: ${info.messageId})`,
        simulated: false,
      };
    } catch (err: any) {
      console.error(`[Email Service] SMTP connection/sending failed:`, err.message || err);
      // Fallback to simulation to avoid blocking application workflows
      console.log(`[Email Service] Falling back to Simulated Sandbox Delivery due to SMTP error.`);
    }
  }

  // Simulated Sandbox Delivery (Fallback for local dev or when secrets are not yet configured)
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [SANDBOX EMAIL SIMULATOR] OUTGOING EMAIL ENVELOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
From: "Samay AI Chief of Staff" <alerts@samayai.com>
To: ${toEmail}
Subject: ${subject}
Date: ${new Date().toUTCString()}
Status: SIMULATED SUCCESS (Configure SMTP_HOST/SMTP_USER in Secrets for real delivery)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTML Payload Preview (Plaintext representation):
${htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  return {
    success: true,
    message: `[Simulated Sandbox SMTP] Daily briefing dispatched to ${toEmail} successfully. (To get real email delivery, configure SMTP_HOST and SMTP_USER in settings)`,
    simulated: true,
  };
}
