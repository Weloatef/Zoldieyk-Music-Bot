// commands/resume.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume a paused song'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '❌ Nothing is playing.', flags: 64 });
    if (!queue.paused)   return interaction.reply({ content: '▶️ Already playing.', flags: 64 });
    queue.resume();
    return interaction.reply('▶️ Resumed.');
  },
};
