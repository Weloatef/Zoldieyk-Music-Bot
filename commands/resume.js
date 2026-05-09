// commands/resume.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume a paused song'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    if (!queue.paused)   return interaction.reply({ content: '▶️ Already playing.', ephemeral: true });
    queue.resume();
    return interaction.reply('▶️ Resumed.');
  },
};
