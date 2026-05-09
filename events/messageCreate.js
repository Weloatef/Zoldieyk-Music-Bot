// events/messageCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const MusicQueue               = require('../queue/MusicQueue');

// Get the best connected Lavalink node in Shoukaku v4
// (getIdealNode does NOT exist in v4 — iterate nodes map instead)
function getNode(shoukaku) {
  return [...shoukaku.nodes.values()]
    .filter(n => n.state === 2) // 2 = CONNECTED
    .sort((a, b) => a.penalties - b.penalties)
    .shift() || null;
}

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild)      return;
    if (message.channelId !== process.env.MUSIC_CHANNEL_ID) return;

    const query = message.content.trim();
    if (!query) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔇 Join a voice channel first!');
    }

    const searching = await message.reply(`🔍 Searching for **${query}**...`);

    // ── Get a live Lavalink node ──────────────────────────────────────────────
    const node = getNode(client.shoukaku);
    if (!node) {
      return searching.edit('❌ No Lavalink nodes available right now. Try again shortly.');
    }

    // ── Search ────────────────────────────────────────────────────────────────
    const isUrl       = /^https?:\/\//.test(query);
    const searchQuery = isUrl ? query : `ytsearch:${query}`;
    let result;
    try {
      result = await node.rest.resolve(searchQuery);
    } catch (err) {
      console.error('[Search Error]', err.message);
      return searching.edit(`❌ Search failed: ${err.message}`);
    }

    if (!result?.data) {
      return searching.edit(`❌ No results found for **${query}**.`);
    }

    // ── Pick tracks ───────────────────────────────────────────────────────────
    let tracksToAdd = [];
    if      (result.loadType === 'track')    tracksToAdd = [result.data];
    else if (result.loadType === 'search')   tracksToAdd = result.data.length ? [result.data[0]] : [];
    else if (result.loadType === 'playlist') tracksToAdd = result.data.tracks;

    if (!tracksToAdd.length) {
      return searching.edit(`❌ No results found for **${query}**.`);
    }

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
      // Clean any stale Shoukaku state for this guild before joining
      const stale = client.shoukaku.connections.has(message.guildId)
                 || client.shoukaku.players.has(message.guildId);
      if (stale) {
        console.log('[VC] Stale state found — cleaning before rejoin...');
        try { await client.shoukaku.leaveVoiceChannel(message.guildId); } catch (_) {}
        client.shoukaku.connections.delete(message.guildId);
        client.shoukaku.players.delete(message.guildId);
        await new Promise(r => setTimeout(r, 500));
      }

      let player;
      try {
        player = await client.shoukaku.joinVoiceChannel({
          guildId  : message.guild.id,
          channelId: voiceChannel.id,
          shardId  : 0,
        });
      } catch (err) {
        console.error('[VC Join Error]', err.message);
        client.shoukaku.connections.delete(message.guildId);
        client.shoukaku.players.delete(message.guildId);
        return searching.edit('❌ Could not join VC — please try again.');
      }

      queue = new MusicQueue(message.guildId, message.channel, player, client);
      client.queues.set(message.guildId, queue);
    }

    // ── Add tracks ────────────────────────────────────────────────────────────
    const firstTrack = makeTrack(tracksToAdd[0]);

    if (result.loadType === 'playlist') {
      for (const t of tracksToAdd) queue.tracks.push(makeTrack(t));
      if (!queue.current) queue._playNext();
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📃 Playlist Added')
        .setDescription(`Added **${tracksToAdd.length}** tracks from **${result.data.info.name}**`);
      await searching.edit({ content: '', embeds: [embed] });
    } else {
      const wasPlaying = !!queue.current;
      await queue.addTrack(firstTrack);
      if (wasPlaying) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('➕ Added to Queue')
          .setDescription(`**[${firstTrack.title}](${firstTrack.uri})**`)
          .addFields(
            { name: 'Duration', value: firstTrack.duration,       inline: true },
            { name: 'Position', value: `#${queue.tracks.length}`, inline: true }
          )
          .setThumbnail(firstTrack.thumbnail);
        await searching.edit({ content: '', embeds: [embed] });
      } else {
        await searching.delete().catch(() => {});
      }
    }
  },
};

function formatDuration(ms) {
  if (!ms) return 'Unknown';
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
