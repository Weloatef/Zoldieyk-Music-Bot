// events/interactionCreate.js
const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
    }

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`[Command Error] /${interaction.commandName}:`, err);
      const msg = { content: '❌ An error occurred running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};
