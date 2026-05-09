# 🎵 Discord Music Bot

A self-hosted Discord music bot that turns any message in a designated channel into a song search. No prefixes, no Jockie, no middleman — just type the song name and it plays.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Auto-search** | Every message in the music channel = YouTube search |
| **Queue system** | Per-server queues, auto-advances |
| **Embeds** | Beautiful "Now Playing" and "Queue" displays |
| **Slash Commands** | `/skip` `/stop` `/pause` `/resume` `/queue` `/nowplaying` |
| **Auto-disconnect** | Leaves VC after 2 min of silence |
| **Direct URLs** | Paste a YouTube link directly |

---

## 🛠 Setup

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org)
- [FFmpeg](https://ffmpeg.org/download.html) — must be in your PATH
  - **Windows:** `winget install Gyan.FFmpeg` or download from ffmpeg.org
  - **Mac:** `brew install ffmpeg`
  - **Linux:** `sudo apt install ffmpeg`

### 2. Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → give it a name
3. Go to **Bot** → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Copy the **Token** (keep it secret!)
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`, `Embed Links`
7. Open the generated URL and invite the bot to your server

### 3. Configure

```bash
# Clone or download this project, then:
cd music-bot
cp .env.example .env
```

Edit `.env`:

```env
BOT_TOKEN=your_bot_token_here
MUSIC_CHANNEL_ID=123456789012345678   # ID of your music text channel
CLIENT_ID=123456789012345678           # Your application ID
GUILD_ID=123456789012345678            # Your server ID
```

**How to get IDs:** In Discord, go to **Settings → Advanced → Enable Developer Mode**.  
Then right-click a channel or server → **Copy ID**.

### 4. Install & Run

```bash
npm install

# Register slash commands with Discord (run once, or after adding new commands)
node deploy-commands.js

# Start the bot
npm start
```

---

## 🎮 Usage

1. Join a voice channel
2. Go to the designated music text channel
3. Type any song name:

```
believer imagine dragons
lofi hip hop chill beats
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

The bot will join your voice channel, search YouTube, and play!

### Slash Commands

| Command | Description |
|---|---|
| `/skip` | Skip the current song |
| `/stop` | Stop music and disconnect |
| `/pause` | Pause playback |
| `/resume` | Resume playback |
| `/queue` | Show the song queue |
| `/nowplaying` | Show current song info |

---

## ☁️ Hosting

### Railway (Easiest)
1. Push code to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Add environment variables in the Railway dashboard
4. Done — 24/7 hosting for free tier

### Other Options
- [Render.com](https://render.com) — free tier available
- [Fly.io](https://fly.io) — good free tier
- Your own VPS (DigitalOcean, Hetzner, etc.)

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| `Error: FFmpeg not found` | Install FFmpeg and make sure it's in your PATH |
| `Sign in to confirm you're not a bot` | play-dl YouTube age restriction — add a YouTube cookie (see play-dl docs) |
| Bot joins but no audio | Confirm `@discordjs/opus` installed: `npm ls @discordjs/opus` |
| Slash commands not showing | Run `node deploy-commands.js` again; can take 30 sec |
| `Missing Access` error | Re-invite the bot with correct permissions |

---

## 🗺 Roadmap

- [ ] Spotify URL support (via play-dl)
- [ ] Song buttons (skip/pause/stop via UI)
- [ ] Loop mode (`/loop`)
- [ ] Volume control
- [ ] Lavalink backend for scale

---

## 📁 Project Structure

```
music-bot/
├── commands/
│   ├── skip.js
│   ├── stop.js
│   ├── pause.js
│   ├── resume.js
│   ├── queue.js
│   └── nowplaying.js
├── events/
│   ├── ready.js
│   ├── messageCreate.js    ← core auto-search logic
│   └── interactionCreate.js
├── music/
│   └── search.js           ← YouTube search via play-dl
├── queue/
│   └── QueueManager.js     ← per-server queue & playback
├── .env.example
├── deploy-commands.js      ← run once to register /commands
├── index.js                ← entry point
└── package.json
```
