// commands/skip.js
const { SlashCommandBuilder } = require('discord.js');
const { getQueue }            = require('../queue/QueueManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);

    if (!queue || !queue.current) {
      return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
    }

    const skipped = queue.current.title;
    queue.skip();

    return interaction.reply(`⏭️ Skipped **${skipped}**.`);
  },
};
