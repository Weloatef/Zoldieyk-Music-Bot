// events/buttonHandler.js
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ITEMS_PER_PAGE = 10;

function buildQueueEmbed(queue, page) {
  const total  = queue.tracks.length;
  const pages  = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  page         = Math.max(0, Math.min(page, pages - 1));
  const slice  = queue.tracks.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const offset = page * ITEMS_PER_PAGE;

  const list = slice.length
    ? slice.map((t, i) => `**${offset + i + 1}.** [${t.title}](${t.uri}) — \`${t.duration}\` • ${t.requester}${t._autoplay ? ' 🤖' : ''}`).join('\n')
    : '_No songs queued._';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Music Queue')
    .setDescription(
      (queue.current ? `▶️ **Now:** [${queue.current.title}](${queue.current.uri}) — \`${queue.current.duration}\`\n\n` : '') +
      `**Up Next:**\n${list}`
    )
    .setFooter({ text: `Page ${page + 1}/${pages} • ${total} song(s) in queue` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_prev_${page}`).setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`queue_next_${page}`).setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
  );

  return { embed, components: total > ITEMS_PER_PAGE ? [row] : [], page };
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    const id    = interaction.customId;
    const queue = client.queues.get(interaction.guildId);

    // ── Queue pagination buttons ─────────────────────────────────────────────
    if (id.startsWith('queue_prev_') || id.startsWith('queue_next_')) {
      await interaction.deferUpdate().catch(() => {});
      if (!queue) return;
      const currentPage = parseInt(id.split('_').pop());
      const newPage     = id.startsWith('queue_prev_') ? currentPage - 1 : currentPage + 1;
      const { embed, components } = buildQueueEmbed(queue, newPage);
      await interaction.editReply({ embeds: [embed], components }).catch(() => {});
      return;
    }

    // ── Music control buttons ─────────────────────────────────────────────────
    if (!id.startsWith('music_')) return;

    await interaction.deferUpdate().catch(() => {});

    if (!queue || !queue.current) {
      return interaction.followUp({ content: '🔇 Nothing is playing.', ephemeral: true }).catch(() => {});
    }

    switch (id) {
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
        await interaction.followUp({
          content: queue.loop ? '🔁 **Loop song** on.' : queue.loopQueue ? '🔁 **Loop queue** on.' : '➡️ Loop off.',
          ephemeral: true,
        }).catch(() => {});
        break;

      case 'music_shuffle':
        if (!queue.tracks.length) {
          await interaction.followUp({ content: '📭 Nothing to shuffle.', ephemeral: true }).catch(() => {});
        } else {
          await queue.shuffle();
          await interaction.followUp({ content: '🔀 Shuffled!', ephemeral: true }).catch(() => {});
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
        if (!queue.tracks.length && !queue.current) {
          await interaction.followUp({ content: '📭 Queue is empty.', ephemeral: true }).catch(() => {});
          return;
        }
        const { embed, components } = buildQueueEmbed(queue, 0);
        await interaction.followUp({ embeds: [embed], components, ephemeral: true }).catch(() => {});
        break;
      }

      case 'music_stop':
        await queue.destroy();
        break;
    }
  },
};