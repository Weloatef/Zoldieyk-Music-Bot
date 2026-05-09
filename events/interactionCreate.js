// events/interactionCreate.js
// ─────────────────────────────────────────────────────────────
//  Routes slash command interactions to the correct handler.
// ─────────────────────────────────────────────────────────────

const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`No command handler found for: /${interaction.commandName}`);
      return interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Command Error] /${interaction.commandName}:`, err);
      const msg = { content: '❌ An error occurred while running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};
