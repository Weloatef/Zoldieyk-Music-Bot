// commands/pause.js
const { SlashCommandBuilder } = require('discord.js');
const { getQueue }            = require('../queue/QueueManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);

    if (!queue || !queue.current) {
      return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }
    if (queue.paused) {
      return interaction.reply({ content: '⏸️ Already paused. Use `/resume` to continue.', ephemeral: true });
    }

    queue.pause();
    return interaction.reply('⏸️ Paused.');
  },
};
