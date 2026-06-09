/**
 * backend/services/emailService.js
 * 
 * SMTP Email Service using Nodemailer.
 * Delivers actual verification codes to player inboxes.
 */

const nodemailer = require('nodemailer');

/**
 * Send actual verification OTP code to the recipient's email address.
 * 
 * @param {string} recipientEmail — target Gmail account
 * @param {string} otpCode        — 6-digit verification code
 * @returns {Promise<{ sent: boolean, fallback: boolean, error?: string }>}
 */
const sendOtpEmail = async (recipientEmail, otpCode) => {
  const targetEmail = recipientEmail.trim().toLowerCase();
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Check if SMTP is not configured or configured with template placeholders
  const isDefaultUser = !user || user.includes('your_verified_gmail');
  const isDefaultPass = !pass || pass.includes('your_google_app_password');

  if (isDefaultUser || isDefaultPass) {
    console.warn(`[email] SMTP credentials not configured in backend/.env. Falling back to console logging.`);
    console.log(`\n==========================================\n[auth] SIMULATED OTP FOR ${targetEmail}:\n👉 CODE: ${otpCode}\n==========================================\n`);
    return { sent: false, fallback: true, error: 'SMTP credentials not configured in backend/.env' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587/other
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"Monopoly India" <${user}>`,
      to: targetEmail,
      subject: '🎲 Verify Your Google Account - Monopoly India',
      html: `
        <div style="background-color: #0c0a09; color: #f3f4f6; font-family: 'DM Sans', Arial, sans-serif; padding: 40px 20px; text-align: center; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 2px solid #d4af37; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
          <div style="font-size: 50px; margin-bottom: 20px;">🎲</div>
          <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #fbbf24; font-size: 28px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em;">
            Monopoly India
          </h1>
          <h3 style="color: #f97316; font-style: italic; font-size: 18px; margin: 0 0 24px 0; font-weight: normal;">
            Google Account Verification
          </h3>
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 0 auto 30px auto; width: 80%;"></div>
          <p style="font-size: 14px; color: #a8a29e; line-height: 1.6; margin-bottom: 30px; padding: 0 20px;">
            Thank you for registering your Gmail account with Monopoly India. Use the secure, one-time verification code below to activate your player profile:
          </p>
          <div style="display: inline-block; background-color: rgba(255,255,255,0.03); border: 1.5px solid rgba(212,175,55,0.45); padding: 18px 40px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(245,158,11,0.15);">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.25em; color: #fbbf24; display: block; font-family: monospace;">
              ${otpCode}
            </span>
          </div>
          <p style="font-size: 11px; color: #78716c; line-height: 1.5; padding: 0 30px; margin-top: 10px;">
            This verification code is valid for exactly 5 minutes. If you did not request this code, please ignore this email.
          </p>
          <div style="height: 1px; background: rgba(212,175,55,0.15); margin: 30px auto 20px auto; width: 60%;"></div>
          <p style="font-size: 10px; color: #57534e;">
            © 2026 Monopoly India Online · Designed for visual excellence
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[email] Real OTP verification sent to ${targetEmail}. MessageId: ${info.messageId}`);
    return { sent: true, fallback: false };
  } catch (err) {
    console.error(`[email] SMTP delivery failed for ${targetEmail}:`, err.message);
    console.log(`\n==========================================\n[auth] FALLBACK OTP FOR ${targetEmail}:\n👉 CODE: ${otpCode}\n==========================================\n`);
    return { sent: false, fallback: true, error: err.message };
  }
};

module.exports = {
  sendOtpEmail
};
