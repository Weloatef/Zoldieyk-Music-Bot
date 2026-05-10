const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show the last 10 songs that were played'),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.history?.length) return interaction.reply({ content: '📜 No history yet.', flags: 64 });
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 Recently Played')
      .setDescription(
        queue.history.slice(0, 10).map((t, i) =>
          `**${i + 1}.** [${t.title}](${t.uri}) — \`${t.duration}\` • ${t.requester}`
        ).join('\n')
      );
    return interaction.reply({ embeds: [embed] });
  },
};