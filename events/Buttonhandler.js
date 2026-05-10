// events/buttonHandler.js
// Handles all music_* button interactions from the Now Playing UI.
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    // Only handle button clicks that start with "music_"
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('music_')) return;

    const queue = client.queues.get(interaction.guildId);
    const btn   = interaction.customId; // e.g. "music_skip"

    // Defer update so Discord doesn't show "interaction failed"
    await interaction.deferUpdate().catch(() => {});

    if (!queue || !queue.current) {
      return interaction.followUp({ content: '🔇 Nothing is playing right now.', ephemeral: true }).catch(() => {});
    }

    switch (btn) {
      case 'music_replay':
        await queue.replay();
        break;

      case 'music_pause':
        if (queue.paused) await queue.resume();
        else              await queue.pause();
        break;

      case 'music_skip':
        queue.skip();
        break;

      case 'music_loop':
        await queue.toggleLoop();
        // Send a small ephemeral hint about which loop mode is now active
        await interaction.followUp({
          content: queue.loop
            ? '🔁 **Loop song** enabled.'
            : queue.loopQueue
              ? '🔁 **Loop queue** enabled.'
              : '➡️ Loop **disabled**.',
          ephemeral: true,
        }).catch(() => {});
        break;

      case 'music_shuffle':
        if (!queue.tracks.length) {
          await interaction.followUp({ content: '📭 Nothing in queue to shuffle.', ephemeral: true }).catch(() => {});
        } else {
          await queue.shuffle();
          await interaction.followUp({ content: '🔀 Queue shuffled!', ephemeral: true }).catch(() => {});
        }
        break;

      case 'music_voldown':
        await queue.setVolume(queue.volume - 10);
        await interaction.followUp({ content: `🔉 Volume: **${queue.volume}%**`, ephemeral: true }).catch(() => {});
        break;

      case 'music_volup':
        await queue.setVolume(queue.volume + 10);
        await interaction.followUp({ content: `🔊 Volume: **${queue.volume}%**`, ephemeral: true }).catch(() => {});
        break;

      case 'music_queue': {
        const tracks = queue.tracks.slice(0, 10);
        const list   = tracks.length
          ? tracks.map((t, i) => `**${i + 1}.** ${t.title} — \`${t.duration}\``).join('\n')
          : '_No songs queued._';
        const embed  = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📋 Queue')
          .setDescription(`▶️ **Now:** ${queue.current.title}\n\n${list}`)
          .setFooter({ text: `${queue.tracks.length} song(s) remaining` });
        await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
        break;
      }

      case 'music_stop':
        await queue.destroy();
        break;
    }
  },
};