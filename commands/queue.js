// commands/queue.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the song queue'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });
    }

    const upcoming = queue.tracks.slice(0, 10);
    const list = upcoming.length
      ? upcoming.map((t, i) => `**${i + 1}.** [${t.title}](${t.uri}) — \`${t.duration}\` • ${t.requester}`).join('\n')
      : '_No songs queued._';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Music Queue')
      .setDescription(
        (queue.current ? `▶️ **Now Playing:** [${queue.current.title}](${queue.current.uri}) — \`${queue.current.duration}\`\n\n` : '') +
        `**Up Next:**\n${list}`
      )
      .setFooter({
        text: queue.tracks.length > 10
          ? `+ ${queue.tracks.length - 10} more not shown`
          : `${queue.tracks.length} song(s) in queue`,
      });

    return interaction.reply({ embeds: [embed] });
  },
};
