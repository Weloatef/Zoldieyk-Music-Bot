// deploy-commands.js
// ─────────────────────────────────────────────────────────────
//  Run this ONCE (node deploy-commands.js) after any command change.
//  Registers slash commands to your specific guild (instant) rather
//  than globally (can take up to 1 hour to propagate).
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs               = require('fs');
const path             = require('path');

const commands = [];
const cmdPath  = path.join(__dirname, 'commands');
const cmdFiles = fs.readdirSync(cmdPath).filter(f => f.endsWith('.js'));

for (const file of cmdFiles) {
  const cmd = require(path.join(cmdPath, file));
  commands.push(cmd.data.toJSON());
  console.log(`  Loaded command: /${cmd.data.name}`);
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`\nRegistering ${commands.length} slash command(s)...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ Slash commands registered successfully!\n');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
