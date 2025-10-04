const SibApiV3Sdk = require('sib-api-v3-sdk');

const apiKey = process.env.BREVO_API_KEY;

const client = SibApiV3Sdk.ApiClient.instance;
const apiKeyInstance = client.authentications['api-key'];
apiKeyInstance.apiKey = apiKey;

const sendEmail = async (to, subject, htmlContent) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sender = { email: 'vijaymudaliyar224@gmail.com', name: 'Expense Management' };
  const receivers = [{ email: to }];

  try {
    await apiInstance.sendTransacEmail({
      sender,
      to: receivers,
      subject,
      htmlContent
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Send credentials email to new user
const sendUserCredentialsEmail = async ({ to, name, password, role, company }) => {
  const subject = 'Your Expense Management Account Credentials';
  const htmlContent = `
    <p>Hello ${name},</p>
    <p>Your account has been created by the admin for <strong>${company}</strong>.</p>
    <p><strong>Login Email:</strong> ${to}<br>
    <strong>Temporary Password:</strong> ${password}</p>
    <p>Role: ${role}</p>
    <p>Please log in and change your password after first login.</p>
    <p>Regards,<br>Expense Management Team</p>
  `;
  return await sendEmail(to, subject, htmlContent);
};

// Send OTP email for password reset
const sendOtpEmail = async (to, otp) => {
  const subject = 'Your Expense Management OTP Code';
  const htmlContent = `
    <p>Your OTP code for password reset is:</p>
    <h2>${otp}</h2>
    <p>This code will expire in 10 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Regards,<br>Expense Management Team</p>
  `;
  return await sendEmail(to, subject, htmlContent);
};

module.exports = { sendEmail, sendUserCredentialsEmail, sendOtpEmail };
