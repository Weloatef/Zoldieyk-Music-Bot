// commands/nowplaying.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show what\'s currently playing'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) {
      return interaction.reply({ content: '🔇 Nothing is playing right now.', flags: 64 });
    }

    const t = queue.current;
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.uri})**`)
      .addFields(
        { name: 'Duration',     value: t.duration  || 'Unknown', inline: true },
        { name: 'Requested by', value: t.requester || 'Unknown', inline: true },
        { name: 'Queue',        value: `${queue.tracks.length} song(s) remaining`, inline: true }
      )
      .setThumbnail(t.thumbnail || null);

    return interaction.reply({ embeds: [embed] });
  },
};
