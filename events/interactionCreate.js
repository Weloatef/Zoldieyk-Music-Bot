// events/interactionCreate.js — slash command router (buttons handled by buttonHandler.js)
const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    // Buttons are handled by buttonHandler.js — skip here
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[Command Error] /${interaction.commandName}:`, err);
      const msg = { content: '❌ An error occurred.', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  },
};