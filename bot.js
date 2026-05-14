const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN environment variable is not set!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const API_BASE_URL = 'https://airsongsapi.vercel.app';

console.log('🤖 AirSongs Telegram Bot is running (polling mode)...');

// /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🎵 *Welcome to AirSongs Bot!* 🎵

Search for any song and I'll help you:
• 🎧 Stream music directly
• 📥 Download MP3 files
• 📝 Get lyrics
• ℹ️ View song details

Just type the name of any song to get started!

*Examples:*
• Arjan Vailly
• Shape of You
• Blinding Lights

Built with ❤️ by AirSongs
  `, { parse_mode: 'Markdown' });
});

// /help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🤖 *AirSongs Bot Commands:*

/start - Start the bot
/help - Show this help message

🔍 *How to use:*
1. Send me any song name
2. Choose from the search results
3. Stream, download, or get lyrics!

💡 *Tips:*
• Be specific with song names for better results
• Include artist name for more accurate search
• All downloads are in high quality MP3 format

🎵 Enjoy your music!
  `, { parse_mode: 'Markdown' });
});

// Song search
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (!messageText || messageText.startsWith('/')) return;

  try {
    bot.sendChatAction(chatId, 'typing');

    const response = await axios.get(`${API_BASE_URL}/result/?query=${encodeURIComponent(messageText)}`);

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return bot.sendMessage(chatId, '❌ No songs found. Try a different search term.');
    }

    const songs = response.data.slice(0, 5);
    await bot.sendMessage(chatId, `🔍 Found ${songs.length} results for "${messageText}":`);

    for (const song of songs) {
      const duration = `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`;
      const songInfo = `🎵 *${song.song}*\n👤 Artist: ${song.primary_artists}\n💽 Album: ${song.album}\n⏱️ Duration: ${duration}\n🗓️ Year: ${song.year}\n🌐 Language: ${song.language}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🎧 Stream', callback_data: `stream_${song.id}` },
            { text: '📥 Download', callback_data: `download_${song.id}` }
          ],
          [
            { text: '📝 Lyrics', callback_data: `lyrics_${song.id}` },
            { text: 'ℹ️ Info', callback_data: `info_${song.id}` }
          ]
        ]
      };

      if (song.image) {
        await bot.sendPhoto(chatId, song.image, {
          caption: songInfo,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await bot.sendMessage(chatId, songInfo, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    }
  } catch (error) {
    console.error('Search error:', error.message);
    bot.sendMessage(chatId, '❌ Sorry, there was an error searching for songs. Please try again.');
  }
});

// Button press handler
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  try {
    const underscoreIndex = data.indexOf('_');
    const action = data.substring(0, underscoreIndex);
    const songId = data.substring(underscoreIndex + 1);

    const songResponse = await axios.get(`${API_BASE_URL}/song/?query=${songId}`);
    let song;
    if (Array.isArray(songResponse.data) && songResponse.data.length > 0) {
      song = songResponse.data[0];
    } else {
      return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Song not found!' });
    }

    switch (action) {
      case 'stream':
        bot.sendChatAction(chatId, 'upload_audio');
        if (song.media_url) {
          await bot.sendAudio(chatId, song.media_url, {
            title: song.song,
            performer: song.primary_artists,
            duration: parseInt(song.duration)
          });
          bot.answerCallbackQuery(callbackQuery.id, { text: '🎧 Streaming...' });
        } else {
          bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Stream not available!' });
        }
        break;

      case 'download':
        if (song.media_url) {
          await bot.sendMessage(chatId, `📥 *Download Link:*\n${song.media_url}\n\n💡 Click the link to download the MP3 file.`, { parse_mode: 'Markdown' });
          bot.answerCallbackQuery(callbackQuery.id, { text: '📥 Download link sent!' });
        } else {
          bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Download not available!' });
        }
        break;

      case 'lyrics':
        bot.sendChatAction(chatId, 'typing');
        try {
          const lyricsResponse = await axios.get(`${API_BASE_URL}/lyrics/?query=${songId}`);
          if (lyricsResponse.data.success && lyricsResponse.data.data?.lyrics) {
            const lyrics = lyricsResponse.data.data.lyrics;
            const truncated = lyrics.length > 3800 ? lyrics.substring(0, 3800) + '\n...' : lyrics;
            await bot.sendMessage(chatId, `📝 *Lyrics for ${song.song}*\n\n${truncated}`, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(callbackQuery.id, { text: '📝 Lyrics loaded!' });
          } else {
            bot.sendMessage(chatId, '❌ Lyrics not available for this song.');
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ No lyrics found!' });
          }
        } catch {
          bot.sendMessage(chatId, '❌ Error fetching lyrics.');
          bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error fetching lyrics!' });
        }
        break;

      case 'info': {
        const duration = `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`;
        await bot.sendMessage(chatId, `ℹ️ *Song Information*\n\n🎵 *Title:* ${song.song}\n👤 *Artist:* ${song.primary_artists}\n💽 *Album:* ${song.album}\n⏱️ *Duration:* ${duration}\n🗓️ *Year:* ${song.year}\n🌐 *Language:* ${song.language}\n▶️ *Play Count:* ${song.play_count ? parseInt(song.play_count).toLocaleString() : 'N/A'}\n🏷️ *Label:* ${song.label || 'N/A'}`, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(callbackQuery.id, { text: 'ℹ️ Song info displayed!' });
        break;
      }

      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Unknown action!' });
    }
  } catch (error) {
    console.error('Callback error:', error.message);
    bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing request!' });
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});
