// deploy-commands.js — run once: node deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];
const cmdDir   = path.join(__dirname, 'commands');
fs.readdirSync(cmdDir).filter(f => f.endsWith('.js')).forEach(file => {
  const cmd = require(path.join(cmdDir, file));
  commands.push(cmd.data.toJSON());
  console.log(`  Queued: /${cmd.data.name}`);
});

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`\nRegistering ${commands.length} slash commands to guild ${process.env.GUILD_ID}...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Done!\n');
  } catch (err) {
    console.error('❌ Registration failed:', err);
  }
})();
