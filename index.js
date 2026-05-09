require('dotenv').config();

// ── Keepalive HTTP server — must start before anything else on Railway ──
const http = require('http');
const server = http.createServer((req, res) => res.end('OK'));
server.listen(process.env.PORT || 3000, () => {
  console.log(`[HTTP] Keepalive server listening on port ${process.env.PORT || 3000}`);
});

// Verify yt-dlp and ffmpeg are available at startup
const { execSync } = require('child_process');
const ytdlpPath = require('path').join(__dirname, 'yt-dlp');

try {
  const version = execSync(`${ytdlpPath} --version`).toString().trim();
  console.log(`[yt-dlp] Found: ${version}`);
} catch (e) {
  console.error(`[yt-dlp] NOT FOUND at ${ytdlpPath}: ${e.message}`);
}

try {
  const ffver = execSync('ffmpeg -version').toString().split('\n')[0];
  console.log(`[ffmpeg] Found: ${ffver}`);
} catch (e) {
  console.error(`[ffmpeg] NOT FOUND: ${e.message}`);
}

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Validate required env vars ────────────────────────────────
const required = ['BOT_TOKEN', 'MUSIC_CHANNEL_ID', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// ── Create the Discord client ─────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ── Load Slash Commands ───────────────────────────────────────
client.commands = new Collection();
const cmdDir   = path.join(__dirname, 'commands');
const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));

for (const file of cmdFiles) {
  const cmd = require(path.join(cmdDir, file));
  client.commands.set(cmd.data.name, cmd);
  console.log(`  📌 Command loaded: /${cmd.data.name}`);
}

// ── Load Events ───────────────────────────────────────────────
const evtDir   = path.join(__dirname, 'events');
const evtFiles = fs.readdirSync(evtDir).filter(f => f.endsWith('.js'));

for (const file of evtFiles) {
  const event = require(path.join(evtDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`  📡 Event loaded: ${event.name}`);
}

// ── Handle unhandled rejections so the process doesn't crash ──
process.on('unhandledRejection', err => {
  console.error('[Unhandled Rejection]', err);
});

// ── Login ─────────────────────────────────────────────────────
console.log('\n🚀 Connecting to Discord...\n');
client.login(process.env.BOT_TOKEN);