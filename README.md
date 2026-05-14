# AirSongs Telegram Bot

A Telegram bot for searching, streaming, downloading songs, and getting lyrics — powered by the AirSongs API.

---

## 🚀 Deployment Guide

### Step 1 — Create your Telegram Bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy your **Bot Token** (looks like `123456:ABC-DEF...`)

---

### Step 2 — Deploy to Vercel (Webhook Mode — Recommended)

This is the production setup. Your bot sleeps at zero cost and wakes on each message.

#### 2a. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

#### 2b. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
2. Add environment variable:
   - **Key:** `TELEGRAM_BOT_TOKEN`
   - **Value:** your bot token from Step 1
3. Click Deploy
4. Copy your deployment URL (e.g. `https://your-app.vercel.app`)

#### 2c. Register the Webhook

```bash
# Set env vars locally
export TELEGRAM_BOT_TOKEN=your_token_here
export WEBHOOK_URL=https://your-app.vercel.app/api/webhook

# Run the setup script
node setup-webhook.js
```

You should see: `✅ Webhook set successfully`

**Your bot is now live!** 🎉

---

### Alternative — Run Locally (Polling Mode)

For development/testing only. Don't run polling and webhook at the same time.

```bash
npm install
export TELEGRAM_BOT_TOKEN=your_token_here
npm start
```

---

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show help |
| _(any text)_ | Search for a song |

## 🎛️ Button Actions

After searching, each result shows:
- **🎧 Stream** — Sends audio directly in Telegram
- **📥 Download** — Sends the MP3 download link
- **📝 Lyrics** — Fetches and displays lyrics
- **ℹ️ Info** — Shows full song details

---

## ⚠️ Security Notes

- **Never** commit your bot token to git
- Always use `TELEGRAM_BOT_TOKEN` environment variable
- The `.gitignore` excludes `.env` files automatically

---

## 🐛 Bugs Fixed (vs original)

1. Syntax error — stray `});` after `sendPhoto` in webhook.js
2. Misaligned `catch` block in lyrics handler
3. Hardcoded bot token removed (security risk)
4. `export default` → `module.exports` (ESM/CJS compatibility fix for Vercel)
5. Added Markdown escaping to prevent parse errors on special characters
6. Added lyrics truncation to stay under Telegram's 4096-char message limit
7. Fixed `split('_')` for song IDs that contain underscores (now uses `indexOf`)
