// index.js
// ─────────────────────────────────────────────────────────────
//  Entry point. Loads all events and commands, then logs in.
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Validate required env vars before anything else ──────────
const required = ['BOT_TOKEN', 'MUSIC_CHANNEL_ID', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    console.error('   Copy .env.example → .env and fill in the values.');
    process.exit(1);
  }
}

// ── Create the Discord client ─────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // Required to read message text
    GatewayIntentBits.GuildVoiceStates, // Required to join voice channels
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

// ── Login ─────────────────────────────────────────────────────
console.log('\n🚀 Connecting to Discord...\n');
client.login(process.env.BOT_TOKEN);
