const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL; // e.g. https://your-app.vercel.app/api/webhook

if (!token || !webhookUrl) {
  console.error('❌ Set TELEGRAM_BOT_TOKEN and WEBHOOK_URL environment variables first.');
  process.exit(1);
}

async function setupWebhook() {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/setWebhook`,
      { url: webhookUrl }
    );
    if (response.data.ok) {
      console.log('✅ Webhook set successfully:', webhookUrl);
    } else {
      console.error('❌ Failed to set webhook:', response.data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupWebhook();
