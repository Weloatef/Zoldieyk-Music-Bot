// commands/stop.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and disconnect the bot'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ The bot is not active here.', ephemeral: true });
    }
    await queue.destroy(client); // passes client so both maps are cleaned
    return interaction.reply('⏹️ Stopped and disconnected.');
  },
};
