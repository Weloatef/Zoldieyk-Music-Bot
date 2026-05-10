# 🎵 Zoldieyk Music Bot

A production-grade self-hosted Discord music bot powered by **Lavalink** (via Shoukaku). No prefixes needed — just type a song name and it plays. Features a full UI control panel, dot commands, slash commands, queue management, stats tracking, and more.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Auto-search** | Every message in the music channel = instant YouTube search & play |
| **UI Control Panel** | Interactive buttons on every Now Playing embed |
| **Progress Bar** | Live `▓▓▓▓░░░░ 2:14 / 3:45` that updates as the song plays |
| **Queue System** | Per-server queues with paginated ◀ ▶ browsing |
| **Autoplay** | Automatically finds a related song when the queue ends |
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
| **Direct URLs** | Paste any YouTube link directly |
| **Lavalink Backend** | Audio over WebSocket — works on Railway, Render, any host |

---

## 🎮 How to Use

1. Join a **voice channel**
2. Go to the designated **music text channel**
3. Type any song name or paste a YouTube URL:

```
blinding lights the weeknd
https://www.youtube.com/watch?v=4NRXx6U8ABQ
lofi hip hop beats to study to
```

The bot joins, searches YouTube, and plays instantly. No prefix needed.

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
[  🔉 Vol−  ]  [ 📋 Queue ]  [ ⏹ Stop ]  [  🔊 Vol+ ]
```

- **🔁 Loop** cycles through Off → Song → Queue → Off and turns green when active
- **📋 Queue** opens a paginated queue visible only to you
- **🔉 🔊** adjust volume by 10% per click

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

# Register slash commands (run once after any command changes)
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
│   ├── skip.js          ← /skip
│   ├── stop.js          ← /stop
│   ├── pause.js         ← /pause
│   ├── resume.js        ← /resume
│   ├── queue.js         ← /queue
│   ├── nowplaying.js    ← /nowplaying
│   ├── loop.js          ← /loop
│   ├── shuffle.js       ← /shuffle
│   ├── volume.js        ← /volume
│   ├── remove.js        ← /remove
│   ├── clear.js         ← /clear
│   ├── replay.js        ← /replay
│   ├── seek.js          ← /seek
│   ├── skipto.js        ← /skipto
│   ├── history.js       ← /history
│   ├── topsongs.js      ← /topsongs
│   ├── mystats.js       ← /mystats
│   └── help.js          ← /help
├── events/
│   ├── clientReady.js
│   ├── messageCreate.js     ← auto-search + dot commands
│   ├── interactionCreate.js ← slash command router
│   └── buttonHandler.js     ← UI button interactions
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
| Slash commands not showing | Run `node deploy-commands.js` — can take up to 30s to appear |
| `Missing Access` error | Re-invite the bot using OAuth2 URL Generator with correct permissions |
| Stats reset | Stats are in-memory — they reset on bot restart by design |
| `npm ci` fails on deploy | Run `npm install` locally, commit the updated `package-lock.json` |

---

## 🗺 Roadmap

- [x] Lavalink backend (no UDP, works on any host)
- [x] UI button controls
- [x] Live progress bar
- [x] Queue pagination
- [x] Autoplay
- [x] Song history
- [x] Stats & leaderboard
- [x] Seek / skip-to
- [x] Loop song + loop queue
- [ ] Audio filters (bassboost, nightcore, 8D)
- [ ] Vote skip
- [ ] DJ role lock
- [ ] Persistent stats (database)
- [ ] Spotify native support (via LavaSrc plugin)

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't respond | Check `MUSIC_CHANNEL_ID` is correct and Message Content Intent is enabled |
| `No Lavalink nodes available` | The public node may be down — try again or switch to another node from [lavalink-list.vercel.app](https://lavalink-list.vercel.app) |
| Bot joins VC but leaves instantly | Stale connection — wait 5s and try again |
| Slash commands not showing | Run `node deploy-commands.js` — can take up to 30s to appear |
| `Missing Access` error | Re-invite the bot using OAuth2 URL Generator with correct permissions |
| Stats reset | Stats are in-memory — they reset on bot restart by design |
| `npm ci` fails on deploy | Run `npm install` locally, commit the updated `package-lock.json` |

---

## 🗺 Roadmap

- [x] Lavalink backend (no UDP, works on any host)
- [x] UI button controls
- [x] Live progress bar
- [x] Queue pagination
- [x] Autoplay
- [x] Song history
- [x] Stats & leaderboard
- [x] Seek / skip-to
- [x] Loop song + loop queue
- [ ] Audio filters (bassboost, nightcore, 8D)
- [ ] Vote skip
- [ ] DJ role lock
- [ ] Persistent stats (database)
- [ ] Spotify native support (via LavaSrc plugin)