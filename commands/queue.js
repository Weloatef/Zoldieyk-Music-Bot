// commands/queue.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue }                          = require('../queue/QueueManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current song queue'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);

    if (!queue || (!queue.current && queue.tracks.length === 0)) {
      return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });
    }

    // Build the track list (max 10 shown)
    const upcoming = queue.tracks.slice(0, 10);
    const list     = upcoming.length
      ? upcoming.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — \`${t.duration}\` • ${t.requester}`).join('\n')
      : '_No songs queued._';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Music Queue')
      .setDescription(
        (queue.current
          ? `▶️ **Now Playing:** [${queue.current.title}](${queue.current.url}) — \`${queue.current.duration}\`\n\n`
          : '') +
        `**Up Next:**\n${list}`
      )
      .setFooter({
        text: queue.tracks.length > 10
          ? `+ ${queue.tracks.length - 10} more song(s) not shown`
          : `${queue.tracks.length} song(s) in queue`,
      });

    return interaction.reply({ embeds: [embed] });
  },
};
