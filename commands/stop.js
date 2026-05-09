// commands/stop.js
const { SlashCommandBuilder } = require('discord.js');
const { getQueue }            = require('../queue/QueueManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and disconnect the bot'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: '❌ The bot is not active in this server.', ephemeral: true });
    }

    queue.destroy();
    return interaction.reply('⏹️ Stopped playback and left the voice channel.');
  },
};
