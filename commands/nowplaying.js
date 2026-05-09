// commands/nowplaying.js
const { SlashCommandBuilder } = require('discord.js');
const { getQueue }            = require('../queue/QueueManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what\'s currently playing'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);

    if (!queue || !queue.current) {
      return interaction.reply({ content: '🔇 Nothing is playing right now.', ephemeral: true });
    }

    // Reuse the queue's built-in embed sender — just send it ephemerally here
    const { EmbedBuilder } = require('discord.js');
    const t = queue.current;

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.url})**`)
      .addFields(
        { name: 'Duration',     value: t.duration  || 'Unknown', inline: true },
        { name: 'Requested by', value: t.requester || 'Unknown', inline: true },
        { name: 'Queue',        value: `${queue.tracks.length} song(s) remaining`, inline: true }
      )
      .setThumbnail(t.thumbnail || null);

    return interaction.reply({ embeds: [embed] });
  },
};
