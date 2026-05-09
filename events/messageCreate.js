// events/messageCreate.js
// ─────────────────────────────────────────────────────────────
//  Fires on every new message.
//  If the message is in the designated MUSIC_CHANNEL_ID,
//  treat the entire content as a song search query.
// ─────────────────────────────────────────────────────────────

const { Events, EmbedBuilder } = require('discord.js');
const { searchTrack }          = require('../music/search');
const { getOrCreateQueue }     = require('../queue/QueueManager');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    // ── Gate: ignore bots and DMs ─────────────────────────
    if (message.author.bot)    return;
    if (!message.guild)        return;

    // ── Gate: only the music channel ─────────────────────
    if (message.channelId !== process.env.MUSIC_CHANNEL_ID) return;

    const query = message.content.trim();
    if (!query) return;

    // ── Gate: user must be in a voice channel ─────────────
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔇 You need to be in a voice channel first!');
    }

    // ── Searching indicator ───────────────────────────────
    const searching = await message.reply(`🔍 Searching for **${query}**...`);

    // ── Search YouTube ────────────────────────────────────
    const track = await searchTrack(query, message.author.username);

    if (!track) {
    return searching.edit(`❌ No results found for **${query}**.`);
    }

    // ── Get or create this guild's queue ──────────────────
    const queue = getOrCreateQueue(message.guildId, message.channel);

    // ── Join VC if not already there ──────────────────────
    if (!queue.connection) {
      try {
        await queue.join(voiceChannel);
      } catch (err) {
        queue.destroy();
        return searching.edit(`❌ ${err.message}`);
      }
    } else {
      // If already connected to a DIFFERENT channel, move
      const currentVCId = queue.connection?.joinConfig?.channelId;
      if (currentVCId && currentVCId !== voiceChannel.id) {
        await queue.join(voiceChannel);
      }
    }

    // ── Add to queue ──────────────────────────────────────
    await queue.addTrack(track);

    // ── "Added to queue" feedback (only when something is already playing) ──
    if (queue.current && queue.current.url !== track.url) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('➕ Added to Queue')
        .setDescription(`**[${track.title}](${track.url})**`)
        .addFields(
          { name: 'Duration',     value: track.duration,             inline: true },
          { name: 'Position',     value: `#${queue.tracks.length}`,  inline: true }
        )
        .setThumbnail(track.thumbnail);

      await searching.edit({ content: '', embeds: [embed] });
    } else {
      await searching.delete().catch(() => {});
    }
  },
};
