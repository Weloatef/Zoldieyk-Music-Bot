# 🎵 Zoldieyk Music Bot

A production-grade self-hosted Discord music bot powered by **Lavalink** (via Shoukaku). No prefixes needed — just type a song name and it plays. Features a full UI control panel, dot commands, slash commands, queue management, stats tracking, and more.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Auto-search** | Every message in the music channel = instant YouTube search & play |
| **Spotify Support** | Paste any Spotify track, album, or playlist URL directly |
| **UI Control Panel** | Interactive buttons on every Now Playing embed |
| **Progress Bar** | Live `▓▓▓▓░░░░ 2:14 / 3:45` that updates as the song plays |
| **Queue System** | Per-server queues with paginated ◀ ▶ browsing |
| **Autoplay** | Toggleable — automatically finds a related song when the queue ends |
| **Song History** | Track the last 20 songs played per session |
| **Stats** | Most played songs leaderboard + per-user queue counts |
| **Loop Modes** | Off → Loop Song → Loop Queue (cycles on each press) |
| **Seek** | Jump to any timestamp in the current song |
| **Skip To** | Skip directly to any position in the queue |
| **Volume Control** | Per-guild volume with buttons and commands |
| **Shuffle** | Randomize the queue instantly |
| **Now Playing Status** | Bot's Discord status always shows the current song |
| **Slash Commands** | Full `/command` support with Discord's autocomplete UI |
| **Dot Commands** | `.command` prefix as an alternative to slash commands |
| **Direct URLs** | Paste any YouTube or Spotify link directly |
| **Lavalink Backend** | Audio over WebSocket — works on Railway, Render, any host |

---

## 🎮 How to Use

1. Join a **voice channel**
2. Go to the designated **music text channel**
3. Type any song name, paste a YouTube URL, or paste a Spotify link:

```
blinding lights the weeknd
https://www.youtube.com/watch?v=4NRXx6U8ABQ
https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b
lofi hip hop beats to study to
```

The bot joins, searches, and plays instantly. No prefix needed.

---

## 🎛️ Commands

All commands work as both **`/slash`** and **`.dot`** style.

### Playback

| Command | Description |
|---|---|
| `.skip` `/skip` | Skip the current song |
| `.stop` `/stop` | Stop music and disconnect |
| `.pause` `/pause` | Pause playback |
| `.resume` `/resume` | Resume playback |
| `.replay` `/replay` | Restart the current song from the beginning |
| `.seek 1:30` `/seek` | Jump to a timestamp (`1:30` or `90` seconds) |
| `.skipto 4` `/skipto` | Skip directly to song #4 in the queue |

### Queue

| Command | Description |
|---|---|
| `.queue` `/queue` | Show the queue with ◀ ▶ page buttons |
| `.np` `/nowplaying` | Show now playing info with live progress bar |
| `.shuffle` `/shuffle` | Shuffle the queue |
| `.remove 3` `/remove` | Remove song at position #3 |
| `.clear` `/clear` | Clear the entire queue (keeps current song) |
| `.history` `/history` | Show last 10 songs played |

### Settings

| Command | Description |
|---|---|
| `.loop` `/loop` | Cycle: Off → Loop Song → Loop Queue |
| `.autoplay` `/autoplay` | Toggle autoplay on/off (default: on) |
| `.volume 80` `/volume` | Set volume (1–100) |

### Stats

| Command | Description |
|---|---|
| `.topsongs` `/topsongs` | Most played songs leaderboard |
| `.mystats` `/mystats` | Your personal queue count and server rank |

### Other

| Command | Description |
|---|---|
| `.help` `/help` | Show the full command list |

---

## 🎛️ UI Buttons

Every **Now Playing** message includes two rows of interactive buttons:

```
[ ⏮ Replay ]  [ ⏸ Pause ]  [ ⏭ Skip ]  [ 🔁 Loop ]  [ 🔀 Shuffle ]
[  🔉 Vol−  ]  [ 📋 Queue ]  [ ⏹ Stop ]  [  🔊 Vol+ ]  [ 🔄 Autoplay ]
```

| Button | Behaviour |
|---|---|
| **🔁 Loop** | Cycles Off → Song → Queue → Off, turns green when active |
| **🔄 Autoplay** | Toggles autoplay on/off, turns green when active |
| **📋 Queue** | Opens paginated queue visible only to you |
| **🔉 🔊** | Adjust volume by 10% per click |

---

## 🛠 Setup

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org)
- A **Lavalink node** — use the free public node below or host your own

### 2. Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it
3. Go to **Bot** → **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Copy the **Token**
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`, `Embed Links`, `Use External Emojis`
7. Open the generated URL and invite the bot

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
BOT_TOKEN=your_bot_token_here
MUSIC_CHANNEL_ID=123456789012345678
CLIENT_ID=123456789012345678
GUILD_ID=123456789012345678

LAVALINK_HOST=lavalinkv4.serenetia.com
LAVALINK_PORT=443
LAVALINK_PASSWORD=https://seretia.link/discord
LAVALINK_SECURE=true
```

> **Get IDs:** Discord Settings → Advanced → Enable Developer Mode → right-click anything → Copy ID

### 4. Install & Run

```bash
npm install

# Register slash commands (run once, and after any command changes)
node deploy-commands.js

# Start
npm start
```

---

## ☁️ Hosting

### Railway (Recommended)
1. Push to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all env vars from `.env` in the Railway dashboard
4. Deploy — bot runs 24/7

### Render
1. Push to GitHub
2. [render.com](https://render.com) → New Web Service → connect repo
3. Add env vars in dashboard
4. Build command: `npm install` · Start command: `node index.js`

### Environment Variables to Set on Host

| Variable | Value |
|---|---|
| `BOT_TOKEN` | Your bot token |
| `CLIENT_ID` | Your application ID |
| `GUILD_ID` | Your server ID |
| `MUSIC_CHANNEL_ID` | The channel ID for music requests |
| `LAVALINK_HOST` | `lavalinkv4.serenetia.com` |
| `LAVALINK_PORT` | `443` |
| `LAVALINK_PASSWORD` | `https://seretia.link/discord` |
| `LAVALINK_SECURE` | `true` |

---

## 📁 Project Structure

```
music-bot/
├── commands/
│   ├── autoplay.js      ← /autoplay
│   ├── clear.js         ← /clear
│   ├── help.js          ← /help
│   ├── history.js       ← /history
│   ├── loop.js          ← /loop
│   ├── mystats.js       ← /mystats
│   ├── nowplaying.js    ← /nowplaying
│   ├── pause.js         ← /pause
│   ├── queue.js         ← /queue
│   ├── remove.js        ← /remove
│   ├── replay.js        ← /replay
│   ├── resume.js        ← /resume
│   ├── seek.js          ← /seek
│   ├── shuffle.js       ← /shuffle
│   ├── skip.js          ← /skip
│   ├── skipto.js        ← /skipto
│   ├── stop.js          ← /stop
│   ├── topsongs.js      ← /topsongs
│   └── volume.js        ← /volume
├── events/
│   ├── buttonHandler.js     ← UI button interactions
│   ├── clientReady.js
│   ├── interactionCreate.js ← slash command router
│   └── messageCreate.js     ← auto-search + dot commands
├── music/
│   └── stats.js             ← play count & user stats tracker
├── queue/
│   └── MusicQueue.js        ← queue, playback, UI, autoplay
├── .env.example
├── deploy-commands.js
├── index.js
└── package.json
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't respond | Check `MUSIC_CHANNEL_ID` is correct and Message Content Intent is enabled |
| `No Lavalink nodes available` | The public node may be down — try again or switch to another node from [lavalink-list.vercel.app](https://lavalink-list.vercel.app) |
| Bot joins VC but leaves instantly | Stale connection — wait 5s and try again |
| Slash commands not showing | Run `node deploy-commands.js` — can take up to 1 hour for global commands |
| `Missing Access` error | Re-invite the bot using OAuth2 URL Generator with correct permissions |
| Spotify URL not working | Your Lavalink node must have the **LavaSrc** plugin — or type the song name instead |
| Stats reset | Stats are in-memory — they reset on bot restart by design |
| `npm ci` fails on deploy | Run `npm install` locally, commit the updated `package-lock.json` |

---

## 🗺 Roadmap

- [x] Lavalink backend (no UDP, works on any host)
- [x] UI button controls
- [x] Live progress bar
- [x] Queue pagination
- [x] Autoplay (toggleable)
- [x] Song history
- [x] Stats & leaderboard
- [x] Seek / skip-to
- [x] Loop song + loop queue
- [x] Spotify link support
- [x] Global slash commands (show in bot profile)
- [ ] Audio filters (bassboost, nightcore, 8D)
- [ ] Vote skip
- [ ] DJ role lock
- [ ] Persistent stats (database)