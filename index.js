// index.js — Discord Music Bot (Lavalink/Shoukaku edition)
// Audio goes through Lavalink over WebSocket (TCP), bypassing UDP blocking on Railway/Render.

require('dotenv').config();

// ── Keepalive HTTP server (required for Railway & Render web services) ──────
const http = require('http');
http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000, () => {
  console.log(`[HTTP] Keepalive listening on port ${process.env.PORT || 3000}`);
});

// ── Validate required env vars ───────────────────────────────────────────────
const REQUIRED = ['BOT_TOKEN', 'MUSIC_CHANNEL_ID', 'CLIENT_ID', 'GUILD_ID',
                  'LAVALINK_HOST', 'LAVALINK_PORT', 'LAVALINK_PASSWORD'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Shoukaku, Connectors }                  = require('shoukaku');
const fs   = require('fs');
const path = require('path');

// ── Discord client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ── Lavalink nodes config ────────────────────────────────────────────────────
const LavalinkNodes = [
  {
    name    : 'Main',
    url     : `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth    : process.env.LAVALINK_PASSWORD,
    secure  : process.env.LAVALINK_SECURE === 'true',
  },
];

// ── Shoukaku (Lavalink client) ───────────────────────────────────────────────
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), LavalinkNodes, {
  moveOnDisconnect: true,
  resumable       : false,
  resumableTimeout: 30,
  reconnectTries  : 3,
  restTimeout     : 10000,
});

shoukaku.on('ready',  (name)        => console.log(`[Lavalink] Node "${name}" connected ✅`));
shoukaku.on('error',  (name, error) => console.error(`[Lavalink] Node "${name}" error:`, error.message));
shoukaku.on('close',  (name, code, reason) => console.warn(`[Lavalink] Node "${name}" closed (${code}): ${reason}`));
shoukaku.on('disconnect', (name, players, moved) => {
  console.warn(`[Lavalink] Node "${name}" disconnected. Players: ${players.length}, moved: ${moved}`);
});

// ── Expose shoukaku on client so events/commands can reach it ────────────────
client.shoukaku = shoukaku;
client.queues   = new Map(); // guildId → MusicQueue instance

// ── Load slash commands ──────────────────────────────────────────────────────
client.commands = new Collection();
const cmdDir    = path.join(__dirname, 'commands');
fs.readdirSync(cmdDir).filter(f => f.endsWith('.js')).forEach(file => {
  const cmd = require(path.join(cmdDir, file));
  client.commands.set(cmd.data.name, cmd);
  console.log(`  📌 Command loaded: /${cmd.data.name}`);
});

// ── Load events ──────────────────────────────────────────────────────────────
const evtDir = path.join(__dirname, 'events');
fs.readdirSync(evtDir).filter(f => f.endsWith('.js')).forEach(file => {
  const event = require(path.join(evtDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name,   (...args) => event.execute(...args, client));
  }
  console.log(`  📡 Event loaded: ${event.name}`);
});

// ── Global error safety net ──────────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('[Unhandled Rejection]', err));

// ── Login ────────────────────────────────────────────────────────────────────
console.log('\n🚀 Connecting to Discord...\n');
client.login(process.env.BOT_TOKEN);
