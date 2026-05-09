// events/messageCreate.js
// Every message in MUSIC_CHANNEL_ID is treated as a song search query.
// Uses Lavalink (via Shoukaku) to resolve and queue audio — no yt-dlp, no UDP.

const { Events, EmbedBuilder } = require('discord.js');
const MusicQueue               = require('../queue/MusicQueue');

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild)      return;
    if (message.channelId !== process.env.MUSIC_CHANNEL_ID) return;

    const query = message.content.trim();
    if (!query) return;

    // ── User must be in a voice channel ──────────────────────────────────────
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔇 Join a voice channel first!');
    }

    const searching = await message.reply(`🔍 Searching for **${query}**...`);

    // ── Wait for Lavalink node to be ready ───────────────────────────────────
    const node = client.shoukaku.getIdealNode();
    if (!node) {
      return searching.edit('❌ No Lavalink nodes are available. Try again in a moment.');
    }

    // ── Search Lavalink ───────────────────────────────────────────────────────
    // Prefix with 'ytsearch:' for text queries, pass URLs directly.
    const isUrl        = /^https?:\/\//.test(query);
    const searchQuery  = isUrl ? query : `ytsearch:${query}`;

    let result;
    try {
      result = await node.rest.resolve(searchQuery);
    } catch (err) {
      console.error('[Search Error]', err.message);
      return searching.edit(`❌ Search failed: ${err.message}`);
    }

    if (!result || !result.data) {
      return searching.edit(`❌ No results found for **${query}**.`);
    }

    // ── Pick tracks from result ───────────────────────────────────────────────
    let tracksToAdd = [];

    if (result.loadType === 'track') {
      tracksToAdd = [result.data];
    } else if (result.loadType === 'search') {
      if (!result.data.length) return searching.edit(`❌ No results found for **${query}**.`);
      tracksToAdd = [result.data[0]]; // first search result only
    } else if (result.loadType === 'playlist') {
      tracksToAdd = result.data.tracks;
    } else {
      return searching.edit(`❌ No results found for **${query}**.`);
    }

    // ── Build track objects ───────────────────────────────────────────────────
    const makeTrack = (t) => ({
      encoded  : t.encoded,
      title    : t.info.title,
      uri      : t.info.uri,
      duration : formatDuration(t.info.length),
      thumbnail: t.info.artworkUrl || null,
      requester: message.author.username,
    });

    // ── Get or create queue ───────────────────────────────────────────────────
    let queue = client.queues.get(message.guildId);

    if (!queue) {
      // Join voice and create a Shoukaku player
      let player;
      try {
        player = await client.shoukaku.joinVoiceChannel({
          guildId  : message.guild.id,
          channelId: voiceChannel.id,
          shardId  : 0,
        });
      } catch (err) {
        console.error('[VC Join Error]', err.message);
        return searching.edit(`❌ Could not join your voice channel: ${err.message}`);
      }

      queue = new MusicQueue(message.guildId, message.channel, player);
      client.queues.set(message.guildId, queue);

      // Clean up from map when player disconnects
      player.on('closed', () => {
        client.queues.delete(message.guildId);
        console.log(`[Queue] Cleaned up queue for guild ${message.guildId}`);
      });
    }

    // ── Add tracks ────────────────────────────────────────────────────────────
    const firstTrack = makeTrack(tracksToAdd[0]);

    if (result.loadType === 'playlist') {
      // Add all playlist tracks
      for (const t of tracksToAdd) queue.tracks.push(makeTrack(t));
      if (!queue.current) queue._playNext();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📃 Playlist Added')
        .setDescription(`Added **${tracksToAdd.length}** tracks from **${result.data.info.name}**`);
      await searching.edit({ content: '', embeds: [embed] });
    } else {
      // Single track
      const wasPlaying = !!queue.current;
      await queue.addTrack(firstTrack);

      if (wasPlaying) {
        // Show "Added to queue" embed since "Now Playing" was already sent
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('➕ Added to Queue')
          .setDescription(`**[${firstTrack.title}](${firstTrack.uri})**`)
          .addFields(
            { name: 'Duration', value: firstTrack.duration, inline: true },
            { name: 'Position', value: `#${queue.tracks.length + (queue.current ? 0 : 1)}`, inline: true }
          )
          .setThumbnail(firstTrack.thumbnail);
        await searching.edit({ content: '', embeds: [embed] });
      } else {
        // "Now Playing" embed was sent by queue — delete searching message
        await searching.delete().catch(() => {});
      }
    }
  },
};

function formatDuration(ms) {
  if (!ms) return 'Unknown';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
