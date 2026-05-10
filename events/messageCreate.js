// events/messageCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const MusicQueue               = require('../queue/MusicQueue');

// ── Dot commands (.skip, .stop, etc.) ────────────────────────────────────────
const DOT_COMMANDS = new Set([
  'skip','stop','pause','resume','queue','np','loop','volume','shuffle','remove','clear'
]);

async function handleDotCommand(cmd, args, message, client) {
  const queue = client.queues.get(message.guildId);

  // Commands that don't need an active queue
  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Music Bot Commands')
      .setDescription([
        '**Playback**',
        '`.skip` — Skip current song',
        '`.stop` — Stop & disconnect',
        '`.pause` — Pause playback',
        '`.resume` — Resume playback',
        '',
        '**Queue**',
        '`.queue` — Show queue',
        '`.np` — Now playing',
        '`.shuffle` — Shuffle the queue',
        '`.remove <number>` — Remove a song from queue',
        '`.clear` — Clear the queue (keeps current song)',
        '',
        '**Settings**',
        '`.loop` — Toggle loop (current song)',
        '`.volume <1-100>` — Set volume',
        '',
        '**Other**',
        '`.help` — Show this menu',
        '',
        '_Just type a song name to play it!_',
      ].join('\n'));
    return message.reply({ embeds: [embed] });
  }

  if (!queue || !queue.current) {
    return message.reply('🔇 Nothing is playing right now.');
  }

  switch (cmd) {
    case 'skip': {
      const title = queue.current.title;
      queue.skip();
      return message.reply(`⏭️ Skipped **${title}**.`);
    }

    case 'stop': {
      await queue.destroy();
      return message.reply('⏹️ Stopped and disconnected.');
    }

    case 'pause': {
      if (queue.paused) return message.reply('⏸️ Already paused.');
      queue.pause();
      return message.reply('⏸️ Paused.');
    }

    case 'resume': {
      if (!queue.paused) return message.reply('▶️ Already playing.');
      queue.resume();
      return message.reply('▶️ Resumed.');
    }

    case 'queue':
    case 'q': {
      if (!queue.tracks.length && !queue.current) {
        return message.reply('📭 The queue is empty.');
      }
      const upcoming = queue.tracks.slice(0, 10);
      const list = upcoming.length
        ? upcoming.map((t, i) => `**${i + 1}.** ${t.title} — \`${t.duration}\` • ${t.requester}`).join('\n')
        : '_No songs queued._';
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Music Queue')
        .setDescription(
          `▶️ **Now:** ${queue.current.title} — \`${queue.current.duration}\`\n\n**Up Next:**\n${list}`
        )
        .setFooter({ text: `${queue.tracks.length} song(s) in queue${queue.loop ? ' • 🔁 Loop ON' : ''}` });
      return message.reply({ embeds: [embed] });
    }

    case 'np':
    case 'nowplaying': {
      const t = queue.current;
      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${t.title}](${t.uri})**`)
        .addFields(
          { name: 'Duration',     value: t.duration  || 'Unknown', inline: true },
          { name: 'Requested by', value: t.requester || 'Unknown', inline: true },
          { name: 'Loop',         value: queue.loop ? '🔁 On' : 'Off', inline: true }
        )
        .setThumbnail(t.thumbnail || null);
      return message.reply({ embeds: [embed] });
    }

    case 'loop': {
      queue.loop = !queue.loop;
      return message.reply(queue.loop ? '🔁 Loop **enabled** — current song will repeat.' : '➡️ Loop **disabled**.');
    }

    case 'shuffle': {
      if (!queue.tracks.length) return message.reply('📭 Nothing in queue to shuffle.');
      for (let i = queue.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
      }
      return message.reply('🔀 Queue shuffled!');
    }

    case 'remove': {
      const pos = parseInt(args[0]);
      if (isNaN(pos) || pos < 1 || pos > queue.tracks.length) {
        return message.reply(`❌ Give a number between 1 and ${queue.tracks.length}.`);
      }
      const removed = queue.tracks.splice(pos - 1, 1)[0];
      return message.reply(`🗑️ Removed **${removed.title}** from the queue.`);
    }

    case 'clear': {
      const count = queue.tracks.length;
      queue.tracks = [];
      return message.reply(`🗑️ Cleared **${count}** song(s) from the queue.`);
    }

    case 'volume':
    case 'vol': {
      const vol = parseInt(args[0]);
      if (isNaN(vol) || vol < 1 || vol > 100) {
        return message.reply('❌ Volume must be between **1** and **100**. Example: `.volume 80`');
      }
      await queue.player.setGlobalVolume(vol);
      queue.volume = vol;
      return message.reply(`🔊 Volume set to **${vol}%**.`);
    }

    default:
      return; // unknown dot command — ignore silently
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

    // ── Dot command? ──────────────────────────────────────────────────────────
    if (content.startsWith('.')) {
      const [rawCmd, ...args] = content.slice(1).trim().split(/\s+/);
      const cmd = rawCmd.toLowerCase();
      if (DOT_COMMANDS.has(cmd) || cmd === 'help') {
        return handleDotCommand(cmd, args, message, client);
      }
      // Unknown dot command — fall through to search (so ".blinding lights" searches)
    }

    // ── Song search ───────────────────────────────────────────────────────────
    const query = content.startsWith('.') ? content.slice(1).trim() : content;
    if (!query) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔇 Join a voice channel first!');
    }

    const searching = await message.reply(`🔍 Searching for **${query}**...`);

    const node = client.shoukaku.getIdealNode();
    if (!node) {
      return searching.edit('❌ No Lavalink nodes available. Try again shortly.');
    }

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

    let queue = client.queues.get(message.guildId);

    if (!queue) {
      if (client.shoukaku.connections.has(message.guildId) ||
          client.shoukaku.players.has(message.guildId)) {
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
        return searching.edit('❌ Could not join VC — please try again in a few seconds.');
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