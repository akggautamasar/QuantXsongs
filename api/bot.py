# api/bot.py

import logging
import os
import json
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from telegram.constants import ParseMode

# Enable logging for detailed output. In Vercel, these logs will appear in your deployment logs.
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- Configuration ---
# IMPORTANT: Get your bot token from Vercel Environment Variables (TELEGRAM_BOT_TOKEN)
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
if not TELEGRAM_BOT_TOKEN:
    logger.error("TELEGRAM_BOT_TOKEN environment variable not set.")
    # In a real deployment, you might want to exit or raise an error here.
    # For local testing, you might temporarily hardcode it, but remove for production.

BASE_API_URL = "https://airsongsapi.vercel.app"

# Initialize the Application outside the webhook function to reuse it across invocations
# This is a common pattern for serverless functions with python-telegram-bot
application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

# --- Helper Functions ---

async def fetch_songs_from_api(query: str):
    """Fetches song data from the JioSaavn API."""
    try:
        url = f"{BASE_API_URL}/result/?query={requests.utils.quote(query)}"
        logger.info(f"Fetching songs from: {url}")
        response = requests.get(url)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching songs from API: {e}")
        return None

async def fetch_lyrics_from_api(song_id: str):
    """Fetches lyrics for a given song ID from the JioSaavn API."""
    try:
        url = f"{BASE_API_URL}/lyrics/?query={requests.utils.quote(song_id)}"
        logger.info(f"Fetching lyrics from: {url}")
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching lyrics from API: {e}")
        return None

# --- Telegram Bot Handlers ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /start command."""
    await update.message.reply_text(
        "Hello! I am QuantXsongs Bot. Send me a song name to search for it, "
        "and I'll provide streaming links, download options, and lyrics."
    )

async def search_songs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Searches for songs based on user's text message."""
    query = update.message.text
    logger.info(f"Received search query: '{query}' from user {update.effective_user.id}")

    await update.message.reply_text(f"Searching for '{query}'... Please wait, this might take a moment.")

    songs = await fetch_songs_from_api(query)

    if not songs:
        await update.message.reply_text("Sorry, I couldn't fetch any songs at the moment. Please try again later.")
        return

    if not songs: # This check is redundant if the previous one handles None, but good for empty list
        await update.message.reply_text(f"No songs found for '{query}'. Please try a different search term.")
        return

    # Limit to a reasonable number of results to avoid spamming chat
    for song in songs[:5]: # Send top 5 results
        if song.get('disabled') == "true":
            status_text = song.get('disabled_text', 'Pro Only')
            message_text = (
                f"🎶 *{song.get('song', 'N/A')}* by {song.get('primary_artists', 'N/A')}\n"
                f"💿 Album: {song.get('album', 'N/A')}\n"
                f"⏳ Duration: {int(song.get('duration', 0)) // 60}:"
                f"{int(song.get('duration', 0)) % 60:02d}\n"
                f"🚫 Status: {status_text} (Streaming/Download not available)"
            )
            await update.message.reply_text(message_text, parse_mode=ParseMode.MARKDOWN)
            continue

        audio_url = song.get('media_url') or song.get('media_preview_url') # Prefer full URL
        image_url = song.get('image')
        perma_url = song.get('perma_url')

        if not audio_url:
            message_text = (
                f"🎶 *{song.get('song', 'N/A')}* by {song.get('primary_artists', 'N/A')}\n"
                f"💿 Album: {song.get('album', 'N/A')}\n"
                f"⏳ Duration: {int(song.get('duration', 0)) // 60}:"
                f"{int(song.get('duration', 0)) % 60:02d}\n"
                f"⚠️ No playable audio found for this song."
            )
            await update.message.reply_text(message_text, parse_mode=ParseMode.MARKDOWN)
            continue

        # Create inline keyboard buttons
        keyboard = []
        if song.get('id'):
            # Callback data for lyrics: 'lyrics_<song_id>'
            keyboard.append(InlineKeyboardButton("Get Lyrics", callback_data=f"lyrics_{song.get('id')}"))
        if perma_url:
            # URL button for JioSaavn link
            keyboard.append(InlineKeyboardButton("View on JioSaavn", url=perma_url))

        reply_markup = InlineKeyboardMarkup([keyboard]) if keyboard else None

        caption_text = (
            f"🎶 *{song.get('song', 'N/A')}* by {song.get('primary_artists', 'N/A')}\n"
            f"💿 Album: {song.get('album', 'N/A')}\n"
            f"⏳ Duration: {int(song.get('duration', 0)) // 60}:"
            f"{int(song.get('duration', 0)) % 60:02d}"
        )

        try:
            # Send audio with thumbnail if available
            await update.message.reply_audio(
                audio=audio_url,
                caption=caption_text,
                parse_mode=ParseMode.MARKDOWN,
                thumbnail=image_url, # Telegram can fetch thumbnail from URL
                performer=song.get('primary_artists', 'N/A'),
                title=song.get('song', 'N/A'),
                reply_markup=reply_markup
            )
        except Exception as e:
            logger.error(f"Failed to send audio for {song.get('song')}: {e}")
            # Fallback to sending text message if audio sending fails
            await update.message.reply_text(
                f"🎶 *{song.get('song', 'N/A')}* by {song.get('primary_artists', 'N/A')}\n"
                f"💿 Album: {song.get('album', 'N/A')}\n"
                f"⏳ Duration: {int(song.get('duration', 0)) // 60}:"
                f"{int(song.get('duration', 0)) % 60:02d}\n"
                f"🔗 [Listen/Download Here]({audio_url})\n"
                f"⚠️ Could not send audio directly, but here's the link. "
                f"Status: {song.get('disabled_text', 'Available')}",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=reply_markup
            )

async def button_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles inline keyboard button presses."""
    query = update.callback_query
    await query.answer() # Acknowledge the callback query to remove the loading spinner

    data = query.data
    logger.info(f"Received callback data: {data}")

    if data.startswith('lyrics_'):
        song_id = data.split('_')[1]
        # Update the message to show "Fetching lyrics..."
        await query.edit_message_text(text="Fetching lyrics... Please wait.")

        lyrics_data = await fetch_lyrics_from_api(song_id)

        if lyrics_data and lyrics_data.get('lyrics'):
            lyrics_text = lyrics_data['lyrics']
            # Telegram has a message length limit (4096 characters), truncate if necessary
            if len(lyrics_text) > 4096:
                lyrics_text = lyrics_text[:4000] + "\n\n... (lyrics truncated due to Telegram message limit)"
            await query.edit_message_text(text=f"📜 *Lyrics:*\n\n{lyrics_text}", parse_mode=ParseMode.MARKDOWN)
        else:
            await query.edit_message_text(text="Sorry, lyrics not found for this song.")
    else:
        await query.edit_message_text(text="Unknown action.")

# --- Setup for Webhook ---

# Add handlers to the application
application.add_handler(CommandHandler("start", start_command))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, search_songs))
application.add_handler(CallbackQueryHandler(button_callback_handler))

# The Vercel entry point for the serverless function
async def handler(request):
    if request.method == "POST":
        # Telegram sends updates as JSON in the request body
        body = await request.get_json()
        update = Update.de_json(body, application.bot)
        await application.process_update(update)
        return {"statusCode": 200, "body": "OK"}
    elif request.method == "GET":
        # For initial webhook setup or health check
        return {"statusCode": 200, "body": "Bot is running!"}
    else:
        return {"statusCode": 405, "body": "Method Not Allowed"}

