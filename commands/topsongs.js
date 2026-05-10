const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTopSongs } = require('../music/stats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topsongs')
    .setDescription('Show the most played songs this session'),
  async execute(interaction) {
    const top = getTopSongs(10);
    if (!top.length) return interaction.reply({ content: '📊 No songs played yet.', flags: 64 });
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Most Played Songs')
      .setDescription(
        top.map((s, i) => `**${i + 1}.** [${s.title}](${s.uri}) — played **${s.count}** time${s.count !== 1 ? 's' : ''}`).join('\n')
      )
      .setFooter({ text: 'Stats reset when bot restarts' });
    return interaction.reply({ embeds: [embed] });
  },
};