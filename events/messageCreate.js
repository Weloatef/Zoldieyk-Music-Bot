// events/messageCreate.js
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { MusicQueue, fmt } = require('../queue/MusicQueue');
const { getTopSongs, getUserStats, getTopUsers } = require('../music/stats');

const ITEMS_PER_PAGE = 10;

function spotifyToSearch(url) {
  const trackMatch = url.match(/spotify\.com\/track\/([A-Za-z0-9]+)/);
  if (trackMatch) return { type: 'spotify_track', id: trackMatch[1] };
  const playlistMatch = url.match(/spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (playlistMatch) return { type: 'spotify_playlist', id: playlistMatch[1] };
  const albumMatch = url.match(/spotify\.com\/album\/([A-Za-z0-9]+)/);
  if (albumMatch) return { type: 'spotify_album', id: albumMatch[1] };
  return null;
}

function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(track|playlist|album)\//.test(url);
}

function parseTime(str) {
  if (!str) return null;
  if (/^\d+$/.test(str)) return parseInt(str) * 1000;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

function buildQueueEmbed(queue, page) {
  const total = queue.tracks.length;
  const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  page        = Math.max(0, Math.min(page, pages - 1));
  const slice  = queue.tracks.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const offset = page * ITEMS_PER_PAGE;

  const list = slice.length
    ? slice.map((t, i) => `**${offset + i + 1}.** [${t.title}](${t.uri}) — \`${t.duration}\` • ${t.requester}${t._autoplay ? ' 🤖' : ''}`).join('\n')
    : '_No songs queued._';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Music Queue')
    .setDescription(
      (queue.current ? `▶️ **Now:** [${queue.current.title}](${queue.current.uri}) — \`${queue.current.duration}\`${queue.loop ? ' 🔁' : queue.loopQueue ? ' 🔁Q' : ''}\n\n` : '') +
      `**Up Next:**\n${list}`
    )
    .setFooter({ text: `Page ${page + 1}/${pages} • ${total} song(s) in queue • Volume: ${queue.volume}%` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queue_prev_${page}`)
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`queue_next_${page}`)
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pages - 1),
  );

  return { embed, components: total > ITEMS_PER_PAGE ? [row] : [], page, pages };
}

async function handleDotCommand(cmd, args, message, client) {
  const queue = client.queues.get(message.guildId);

  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Music Bot Commands')
      .setDescription([
        '**Playback**',
        '`.skip` — Skip current song',
        '`.stop` — Stop & disconnect',
        '`.pause` — Pause',
        '`.resume` — Resume',
        '`.replay` — Restart current song',
        '`.seek 1:30` — Jump to timestamp',
        '`.skipto 4` — Skip to song #4 in queue',
        '',
        '**Queue**',
        '`.queue` — Show queue (with pages)',
        '`.np` — Now playing + progress',
        '`.shuffle` — Shuffle queue',
        '`.remove <n>` — Remove song at position',
        '`.clear` — Clear queue',
        '`.history` — Last 10 played songs',
        '',
        '**Settings**',
        '`.loop` — Cycle: Off → Song → Queue',
        '`.autoplay` — Toggle autoplay on/off',
        '`.volume <1-100>` — Set volume',
        '',
        '**Stats**',
        '`.topsongs` — Most played songs',
        '`.mystats` — Your queued songs this session',
        '',
        '_Type any song name or paste a YouTube/Spotify link to play!_',
      ].join('\n'));
    return message.reply({ embeds: [embed] });
  }

  if (cmd === 'topsongs') {
    const top = getTopSongs(10);
    if (!top.length) return message.reply('📊 No songs played yet this session.');
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Most Played Songs')
      .setDescription(
        top.map((s, i) => `**${i + 1}.** [${s.title}](${s.uri}) — played **${s.count}** time${s.count !== 1 ? 's' : ''}`).join('\n')
      )
      .setFooter({ text: 'Stats reset when bot restarts' });
    return message.reply({ embeds: [embed] });
  }

  if (cmd === 'mystats') {
    const stats    = getUserStats(message.author.id);
    const topUsers = getTopUsers(5);
    const rank     = topUsers.findIndex(u => u.id === message.author.id) + 1;
    const embed    = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 Stats for ${message.author.username}`)
      .addFields(
        { name: 'Songs Queued', value: stats ? `${stats.count}` : '0', inline: true },
        { name: 'Server Rank',  value: rank ? `#${rank}` : 'Unranked', inline: true },
      );
    if (topUsers.length) {
      embed.addFields({
        name : '🏅 Top Queuers',
        value: topUsers.map((u, i) => `**${i + 1}.** ${u.username} — ${u.count} songs`).join('\n'),
      });
    }
    embed.setFooter({ text: 'Stats reset when bot restarts' });
    return message.reply({ embeds: [embed] });
  }

  if (cmd === 'history') {
    if (!queue?.history?.length) return message.reply('📜 No history yet.');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 Recently Played')
      .setDescription(
        queue.history.slice(0, 10).map((t, i) =>
          `**${i + 1}.** [${t.title}](${t.uri}) — \`${t.duration}\` • ${t.requester}`
        ).join('\n')
      );
    return message.reply({ embeds: [embed] });
  }

  // Commands below need active queue
  if (!queue || !queue.current) {
    return message.reply('🔇 Nothing is playing right now.');
  }

  switch (cmd) {
    case 'skip': {
      const title = queue.current.title;
      queue.skip();
      return message.reply(`⏭️ Skipped **${title}**.`);
    }

    case 'stop':
      await queue.destroy();
      return message.reply('⏹️ Stopped and disconnected.');

    case 'pause':
      if (queue.paused) return message.reply('⏸️ Already paused.');
      await queue.pause();
      return message.reply('⏸️ Paused.');

    case 'resume':
      if (!queue.paused) return message.reply('▶️ Already playing.');
      await queue.resume();
      return message.reply('▶️ Resumed.');

    case 'replay':
      await queue.replay();
      return message.reply(`⏮ Replaying **${queue.current?.title || 'current song'}**.`);

    case 'seek': {
      if (!args[0]) return message.reply('❌ Usage: `.seek 1:30` or `.seek 90`');
      const ms = parseTime(args[0]);
      if (!ms) return message.reply('❌ Invalid time. Use `1:30` or `90` (seconds).');
      if (queue.current.durationMs && ms > queue.current.durationMs)
        return message.reply(`❌ Song is only ${queue.current.duration} long.`);
      await queue.seek(ms);
      return message.reply(`⏩ Jumped to **${fmt(ms)}**.`);
    }

    case 'skipto': {
      const pos = parseInt(args[0]);
      if (isNaN(pos) || pos < 1) return message.reply('❌ Usage: `.skipto 3`');
      if (pos > queue.tracks.length) return message.reply(`❌ Queue only has **${queue.tracks.length}** song(s).`);
      const target = queue.tracks[pos - 1]?.title || `#${pos}`;
      const ok = await queue.skipTo(pos);
      if (!ok) return message.reply('❌ Could not skip to that position.');
      return message.reply(`⏭️ Skipping to **${target}**.`);
    }

    case 'queue':
    case 'q': {
      const { embed, components } = buildQueueEmbed(queue, 0);
      return message.reply({ embeds: [embed], components });
    }

    case 'np':
    case 'nowplaying': {
      const t = queue.current;
      const pos = queue.player.position || 0;
      const dur = t.durationMs || 0;
      const bar = dur > 0
        ? `\`${'▓'.repeat(Math.round(Math.min(pos/dur,1)*12))}${'░'.repeat(12-Math.round(Math.min(pos/dur,1)*12))}\` ${fmt(pos)} / ${fmt(dur)}`
        : '──────────────';
      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${t.title}](${t.uri})**\n\n${bar}`)
        .addFields(
          { name: 'Requested by', value: t.requester       || 'Unknown',  inline: true },
          { name: 'Loop',         value: queue.loop ? '🔁 Song' : queue.loopQueue ? '🔁 Queue' : 'Off', inline: true },
          { name: 'Autoplay',     value: queue.autoplay ? '🔄 On' : '⏹ Off', inline: true },
          { name: 'Volume',       value: `🔊 ${queue.volume}%`, inline: true },
        )
        .setThumbnail(t.thumbnail || null);
      return message.reply({ embeds: [embed] });
    }

    case 'loop':
      await queue.toggleLoop();
      return message.reply(queue.loop ? '🔁 Loop **song** enabled.' : queue.loopQueue ? '🔁 Loop **queue** enabled.' : '➡️ Loop disabled.');

    case 'autoplay': {
      const state = await queue.toggleAutoplay();
      return message.reply(state ? '🔄 Autoplay **enabled**.' : '⏹ Autoplay **disabled**.');
    }

    case 'shuffle':
      if (!queue.tracks.length) return message.reply('📭 Nothing to shuffle.');
      await queue.shuffle();
      return message.reply('🔀 Queue shuffled!');

    case 'remove': {
      const pos = parseInt(args[0]);
      if (isNaN(pos) || pos < 1 || pos > queue.tracks.length)
        return message.reply(`❌ Give a number between 1 and ${queue.tracks.length}.`);
      const removed = queue.tracks.splice(pos - 1, 1)[0];
      return message.reply(`🗑️ Removed **${removed.title}**.`);
    }

    case 'clear': {
      const count = queue.tracks.length;
      queue.tracks = [];
      return message.reply(`🗑️ Cleared **${count}** song(s).`);
    }

    case 'volume':
    case 'vol': {
      const vol = parseInt(args[0]);
      if (isNaN(vol) || vol < 1 || vol > 100)
        return message.reply('❌ Volume must be 1–100. Example: `.volume 80`');
      await queue.setVolume(vol);
      return message.reply(`🔊 Volume set to **${vol}%**.`);
    }

    default:
      return;
  }
}

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild)      return;
    if (message.channelId !== process.env.MUSIC_CHANNEL_ID) return;

    const content = message.content.trim();
    if (!content) return;

    if (content.startsWith('.')) {
      const [rawCmd, ...args] = content.slice(1).trim().split(/\s+/);
      const cmd = rawCmd.toLowerCase();
      const DOT_COMMANDS = new Set([
        'skip','stop','pause','resume','queue','q','np','nowplaying',
        'loop','autoplay','shuffle','remove','clear','volume','vol','replay',
        'seek','skipto','history','topsongs','mystats','help'
      ]);
      if (DOT_COMMANDS.has(cmd)) return handleDotCommand(cmd, args, message, client);
    }

    const query = content.startsWith('.') ? content.slice(1).trim() : content;
    if (!query) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('🔇 Join a voice channel first!');

    const searching = await message.reply(`🔍 Searching for **${query}**...`);

    const node = client.shoukaku.getIdealNode();
    if (!node) return searching.edit('❌ No Lavalink nodes available.');

    let searchQuery = query;

    if (isSpotifyUrl(query)) {
      spotifyToSearch(query); // parse but we try native first
      try {
        const directResult = await node.rest.resolve(query);
        if (directResult?.data && directResult.loadType !== 'error' && directResult.loadType !== 'empty') {
          return await processResult(directResult, query, message, searching, voiceChannel, client);
        }
      } catch (_) {}
      return searching.edit(
        '❌ Your Lavalink node doesn\'t support Spotify URLs directly.\n' +
        '💡 Copy the song name from Spotify and type it instead, or ask your admin to install the **LavaSrc** plugin on the Lavalink server.'
      );
    }

    const isUrl = /^https?:\/\//.test(query);
    searchQuery  = isUrl ? query : `ytsearch:${query}`;

    let result;
    try {
      result = await node.rest.resolve(searchQuery);
    } catch (err) {
      console.error('[Search Error]', err.message);
      return searching.edit(`❌ Search failed: ${err.message}`);
    }

    await processResult(result, query, message, searching, voiceChannel, client);
  },
};

async function processResult(result, query, message, searching, voiceChannel, client) {
  if (!result?.data) return searching.edit(`❌ No results found for **${query}**.`);

  let tracksToAdd = [];
  if      (result.loadType === 'track')    tracksToAdd = [result.data];
  else if (result.loadType === 'search')   tracksToAdd = result.data.length ? [result.data[0]] : [];
  else if (result.loadType === 'playlist') tracksToAdd = result.data.tracks;

  if (!tracksToAdd.length) return searching.edit(`❌ No results found for **${query}**.`);

  const makeTrack = (t) => ({
    encoded      : t.encoded,
    title        : t.info.title,
    uri          : t.info.uri,
    duration     : fmt(t.info.length),
    durationMs   : t.info.length,
    thumbnail    : t.info.artworkUrl || null,
    requester    : message.author.username,
    _requesterId : message.author.id,
    _autoplay    : false,
  });

  let queue = client.queues.get(message.guildId);

  if (!queue) {
    if (client.shoukaku.connections.has(message.guildId) || client.shoukaku.players.has(message.guildId)) {
      console.log('[VC] Cleaning stale connection...');
      try { await client.shoukaku.leaveVoiceChannel(message.guildId); } catch (_) {}
      client.shoukaku.connections.delete(message.guildId);
      client.shoukaku.players.delete(message.guildId);
      await new Promise(r => setTimeout(r, 800));
    }

    let player;
    try {
      player = await client.shoukaku.joinVoiceChannel({
        guildId  : message.guild.id,
        channelId: voiceChannel.id,
        shardId  : message.guild.shardId ?? 0,
        deaf     : true,
      });
    } catch (err) {
      console.error('[VC Join Error]', err.message);
      try { await client.shoukaku.leaveVoiceChannel(message.guildId); } catch (_) {}
      client.shoukaku.connections.delete(message.guildId);
      client.shoukaku.players.delete(message.guildId);
      return searching.edit('❌ Could not join VC — please try again.');
    }

    queue = new MusicQueue(message.guildId, message.channel, player, client);
    client.queues.set(message.guildId, queue);
  }

  const firstTrack = makeTrack(tracksToAdd[0]);

  if (result.loadType === 'playlist') {
    for (const t of tracksToAdd) queue.tracks.push(makeTrack(t));
    if (!queue.current) queue._playNext();
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📃 Playlist Added')
      .setDescription(`Added **${tracksToAdd.length}** tracks from **${result.data.info?.name || 'playlist'}**`);
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
}