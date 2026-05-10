const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the songs in the queue'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    if (!queue.tracks.length) return interaction.reply({ content: '📭 Nothing in queue to shuffle.', flags: 64 });
    await queue.shuffle();
    return interaction.reply('🔀 Queue shuffled!');
  },
};
