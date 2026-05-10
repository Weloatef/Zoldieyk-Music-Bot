const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserStats, getTopUsers } = require('../music/stats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('Show your music stats for this session'),
  async execute(interaction) {
    const stats    = getUserStats(interaction.user.id);
    const topUsers = getTopUsers(5);
    const rank     = topUsers.findIndex(u => u.id === interaction.user.id) + 1;
    const embed    = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 Stats for ${interaction.user.username}`)
      .addFields(
        { name: 'Songs Queued', value: stats ? `${stats.count}` : '0', inline: true },
        { name: 'Server Rank',  value: rank ? `#${rank}` : 'Unranked',  inline: true },
      );
    if (topUsers.length) {
      embed.addFields({
        name : '🏅 Top Queuers',
        value: topUsers.map((u, i) => `**${i + 1}.** ${u.username} — ${u.count} songs`).join('\n'),
      });
    }
    embed.setFooter({ text: 'Stats reset when bot restarts' });
    return interaction.reply({ embeds: [embed] });
  },
};