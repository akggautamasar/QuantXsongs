const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Bot token
const token = '7829395449:AAF15rd4Jb4kcwx7Cnu2p0lpS79BpwqgB8M';
const bot = new TelegramBot(token, { polling: true });

const API_BASE_URL = 'https://airsongsapi.vercel.app';

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🎵 Welcome to AirSongs Bot! 🎵

Search for any song and I'll help you:
• 🎧 Stream music directly
• 📥 Download MP3 files
• 📝 Get lyrics
• ℹ️ View song details

Just type the name of any song to get started!

Examples:
• Arjan Vailly
• Shape of You
• Blinding Lights

Built with ❤️ by AirSongs | Powered by Airbooks & Lovable
  `;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
🤖 AirSongs Bot Commands:

/start - Start the bot
/help - Show this help message

🔍 How to use:
1. Send me any song name
2. Choose from the search results
3. Stream, download, or get lyrics!

💡 Tips:
• Be specific with song names for better results
• Include artist name for more accurate search
• All downloads are in high quality MP3 format

🎵 Enjoy your music!
`;
  
  bot.sendMessage(chatId, helpMessage);
});

// Handle text messages (song search)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // Skip commands
  if (messageText.startsWith('/')) {
    return;
  }

  try {
    // Send typing action
    bot.sendChatAction(chatId, 'typing');

    // Search for songs
    const searchUrl = `${API_BASE_URL}/result/?query=${encodeURIComponent(messageText)}`;
    const response = await axios.get(searchUrl);
    
    if (!Array.isArray(response.data) || response.data.length === 0) {
      bot.sendMessage(chatId, '❌ No songs found. Try a different search term.');
      return;
    }

    // Limit to top 5 results
    const songs = response.data.slice(0, 5);
    
    bot.sendMessage(chatId, `🔍 Found ${songs.length} results for "${messageText}":`);

    // Send each song as a separate message with inline keyboard
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      
      const songInfo = `
🎵 *${song.song}*
👤 Artist: ${song.primary_artists}
💽 Album: ${song.album}
⏱️ Duration: ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}
🗓️ Year: ${song.year}
🌐 Language: ${song.language}
      `;
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

      // Send photo with song info
      if (song.image) {
        bot.sendPhoto(chatId, song.image, {
          caption: songInfo,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        bot.sendMessage(chatId, songInfo, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    }

  } catch (error) {
    console.error('Search error:', error);
    bot.sendMessage(chatId, '❌ Sorry, there was an error searching for songs. Please try again.');
  }
});

// Handle callback queries (button presses)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  try {
    const [action, songId] = data.split('_');
    
    // Get song details
    const songUrl = `${API_BASE_URL}/song/?query=${songId}`;
    const songResponse = await axios.get(songUrl);
    
    let song;
    if (Array.isArray(songResponse.data) && songResponse.data.length > 0) {
      song = songResponse.data[0];
    } else {
      bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Song not found!' });
      return;
    }
    switch (action) {
      case 'stream':
        bot.sendChatAction(chatId, 'upload_audio');
        
        // Send audio for streaming
        if (song.media_url) {
          bot.sendAudio(chatId, song.media_url, {
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
          bot.sendMessage(chatId, `📥 Download Link:\n${song.media_url}\n\n💡 Click the link to download the MP3 file.`);
          bot.answerCallbackQuery(callbackQuery.id, { text: '📥 Download link sent!' });
        } else {
          bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Download not available!' });
        }
        break;

      case 'lyrics':
        bot.sendChatAction(chatId, 'typing');
        
        try {
          const lyricsUrl = `${API_BASE_URL}/lyrics/?query=${songId}`;
          const lyricsResponse = await axios.get(lyricsUrl);
          
          if (lyricsResponse.data.success && lyricsResponse.data.data && lyricsResponse.data.data.lyrics) {
            const lyrics = lyricsResponse.data.data.lyrics;
            bot.sendMessage(chatId, `📝 *Lyrics for ${song.song}*\n\n${lyrics}`, {
              parse_mode: 'Markdown'
            });
            bot.answerCallbackQuery(callbackQuery.id, { text: '📝 Lyrics loaded!' });
          } else {
            bot.sendMessage(chatId, '❌ Lyrics not available for this song.');
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ No lyrics found!' });
          }
        } catch (error) {
          bot.sendMessage(chatId, '❌ Error fetching lyrics.');
          bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error fetching lyrics!' });
        }
        break;
        
      case 'info':
        const infoMessage = `
ℹ️ *Song Information*

🎵 *Title:* ${song.song}
👤 *Artist:* ${song.primary_artists}
💽 *Album:* ${song.album}
⏱️ *Duration:* ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}
🗓️ *Year:* ${song.year}
🌐 *Language:* ${song.language}
▶️ *Play Count:* ${song.play_count ? parseInt(song.play_count).toLocaleString() : 'N/A'}
🏷️ *Label:* ${song.label || 'N/A'}
        `;
        
        bot.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
        bot.answerCallbackQuery(callbackQuery.id, { text: 'ℹ️ Song info displayed!' });
        break;

      default:
        bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Unknown action!' });
    }

  } catch (error) {
    console.error('Callback query error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing request!' });
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 AirSongs Telegram Bot is running...');
console.log('Bot username: @Airarchivebot');
