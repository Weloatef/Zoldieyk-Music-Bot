// commands/pause.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    if (queue.paused)    return interaction.reply({ content: '⏸️ Already paused.', ephemeral: true });
    queue.pause();
    return interaction.reply('⏸️ Paused.');
  },
};
