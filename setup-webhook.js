
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN || '7829395449:AAF15rd4Jb4kcwx7Cnu2p0lpS79BpwqgB8M';
const webhookUrl = process.env.WEBHOOK_URL; // Your Vercel deployment URL + /api/webhook

async function setWebhook() {
  if (!webhookUrl) {
    console.error('Please set WEBHOOK_URL environment variable');
    process.exit(1);
  }

  try {
    const response = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
      url: webhookUrl
    });
    
    console.log('Webhook set successfully:', response.data);
  } catch (error) {
    console.error('Error setting webhook:', error.response?.data || error.message);
  }
}

setWebhook();
