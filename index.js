// index.js — Discord Music Bot (Lavalink/Shoukaku v4 edition)
require('dotenv').config();

// ── Keepalive HTTP server ────────────────────────────────────────────────────
const http = require('http');
http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000, () => {
  console.log(`[HTTP] Keepalive listening on port ${process.env.PORT || 3000}`);
});

// ── Validate env vars ────────────────────────────────────────────────────────
const REQUIRED = ['BOT_TOKEN', 'MUSIC_CHANNEL_ID', 'CLIENT_ID', 'GUILD_ID',
                  'LAVALINK_HOST', 'LAVALINK_PORT', 'LAVALINK_PASSWORD'];
for (const key of REQUIRED) {
  if (!process.env[key]) { console.error(`❌ Missing: ${key}`); process.exit(1); }
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

// ── Lavalink nodes ───────────────────────────────────────────────────────────
const LavalinkNodes = [{
  name  : 'Main',
  url   : `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
  auth  : process.env.LAVALINK_PASSWORD,
  secure: process.env.LAVALINK_SECURE === 'true',
}];

// ── Shoukaku (Lavalink client) ───────────────────────────────────────────────
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), LavalinkNodes, {
  moveOnDisconnect: true,
  resumable       : false,
  resumableTimeout: 30,
  reconnectTries  : 3,
  restTimeout     : 10000,
});

// Shoukaku v4 emits 'ready' on the node (not client), suppress the discord.js rename warning
shoukaku.on('ready',      (name)        => console.log(`[Lavalink] Node "${name}" connected ✅`));
shoukaku.on('error',      (name, error) => console.error(`[Lavalink] Node "${name}" error:`, error.message));
shoukaku.on('close',      (name, code)  => console.warn(`[Lavalink] Node "${name}" closed (${code})`));
shoukaku.on('disconnect', (name)        => console.warn(`[Lavalink] Node "${name}" disconnected`));

client.shoukaku = shoukaku;
client.queues   = new Map();

// ── Load slash commands ──────────────────────────────────────────────────────
client.commands = new Collection();
const cmdDir    = path.join(__dirname, 'commands');
fs.readdirSync(cmdDir).filter(f => f.endsWith('.js')).forEach(file => {
  const cmd = require(path.join(cmdDir, file));
  client.commands.set(cmd.data.name, cmd);
  console.log(`  📌 Command loaded: /${cmd.data.name}`);
});

// ── Load events ──────────────────────────────────────────────────────────────
// Only load each event name ONCE — skip duplicates
const evtDir      = path.join(__dirname, 'events');
const loadedNames = new Set();

fs.readdirSync(evtDir).filter(f => f.endsWith('.js')).forEach(file => {
  const event = require(path.join(evtDir, file));
  if (loadedNames.has(event.name)) {
    console.warn(`  ⚠️  Skipping duplicate event: ${event.name} (${file})`);
    return;
  }
  loadedNames.add(event.name);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name,   (...args) => event.execute(...args, client));
  }
  console.log(`  📡 Event loaded: ${event.name}`);
});

process.on('unhandledRejection', err => console.error('[Unhandled Rejection]', err));

console.log('\n🚀 Connecting to Discord...\n');
client.login(process.env.BOT_TOKEN);
