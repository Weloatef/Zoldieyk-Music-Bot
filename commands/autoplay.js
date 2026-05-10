// commands/autoplay.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay — automatically queues a related song when the queue ends'),

  async execute(interaction) {
    const queue = interaction.client.queues.get(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Nothing is playing.', flags: 64 });
    }
    const state = await queue.toggleAutoplay();
    return interaction.reply(state
      ? '🔄 Autoplay **enabled** — I\'ll keep the music going when the queue ends.'
      : '⏹ Autoplay **disabled** — I\'ll stop when the queue is empty.'
    );
  },
};