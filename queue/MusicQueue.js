// queue/MusicQueue.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const { recordPlay } = require('../music/stats');

function buildProgressBar(position, duration, length = 12) {
  if (!duration || duration <= 0) return '──────────────';
  const pct    = Math.min(position / duration, 1);
  const filled = Math.round(pct * length);
  const empty  = length - filled;
  return `\`${'▓'.repeat(filled)}${'░'.repeat(empty)}\` ${fmt(position)} / ${fmt(duration)}`;
}

function fmt(ms) {
  if (!ms) return '0:00';
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

class MusicQueue {
  constructor(guildId, textChannel, player, client) {
    this.guildId     = guildId;
    this.textChannel = textChannel;
    this.player      = player;
    this.client      = client;
    this.tracks      = [];
    this.history     = [];
    this.current     = null;
    this.paused      = false;
    this.loop        = false;
    this.loopQueue   = false;
    this.autoplay    = true;   // ← new: toggleable autoplay
    this.volume      = 100;
    this._idleTimer  = null;
    this._destroyed  = false;
    this._npMessage  = null;
    this._progressInterval = null;

    this.player.on('end', data => {
      if (data.reason === 'replaced') return;
      if (this.loop      && this.current) this.tracks.unshift({ ...this.current });
      else if (this.loopQueue && this.current) this.tracks.push({ ...this.current });
      this._playNext();
    });

    this.player.on('exception', err => {
      console.error(`[Player Exception] ${err?.message || err}`);
      this.textChannel.send('⚠️ Playback error — skipping.').catch(() => {});
      this._playNext();
    });

    this.player.on('stuck',   () => { console.warn('[Stuck]'); this._playNext(); });
    this.player.on('closed',  () => { console.warn(`[Player] Closed — guild ${this.guildId}`); this._cleanup(); });
    this.player.on('update',  () => {});
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  _buildUI() {
    const t        = this.current;
    const pos      = this.player.position || 0;
    const dur      = t.durationMs         || 0;
    const progress = buildProgressBar(pos, dur);

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.uri})**\n\n${progress}`)
      .addFields(
        { name: 'Requested by', value: t.requester            || 'Unknown',  inline: true },
        { name: 'Queue',        value: `${this.tracks.length} song(s)`,       inline: true },
        { name: 'Loop',         value: this.loop ? '🔁 Song' : this.loopQueue ? '🔁 Queue' : 'Off', inline: true },
        { name: 'Volume',       value: `🔊 ${this.volume}%`,                  inline: true },
        { name: 'Autoplay',     value: this.autoplay ? '🔄 On' : '⏹ Off',    inline: true },
      )
      .setThumbnail(t.thumbnail || null)
      .setFooter({ text: 'Type a song name to queue more' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_replay')   .setEmoji('⏮').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_pause')    .setEmoji(this.paused ? '▶️' : '⏸').setStyle(this.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip')     .setEmoji('⏭').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_loop')     .setEmoji('🔁').setStyle(this.loop || this.loopQueue ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_shuffle')  .setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown')  .setEmoji('🔉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_queue')    .setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop')     .setEmoji('⏹').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_volup')    .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_autoplay') .setEmoji('🔄').setStyle(this.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2] };
  }

  _disableButtons(rows) {
    return rows.map(row => {
      const r = new ActionRowBuilder();
      r.addComponents(row.components.map(b => ButtonBuilder.from(b).setDisabled(true)));
      return r;
    });
  }

  async _sendNowPlaying() {
    if (this._npMessage) {
      try { await this._npMessage.edit({ components: this._disableButtons(this._npMessage.components) }); } catch (_) {}
    }
    this._stopProgressInterval();
    const { embed, components } = this._buildUI();
    this._npMessage = await this.textChannel.send({ embeds: [embed], components }).catch(() => null);
    this._startProgressInterval();
  }

  _startProgressInterval() {
    this._stopProgressInterval();
    this._progressInterval = setInterval(async () => {
      if (!this._npMessage || !this.current || this.paused) return;
      const { embed, components } = this._buildUI();
      try { await this._npMessage.edit({ embeds: [embed], components }); } catch (_) { this._stopProgressInterval(); }
    }, 15_000);
  }

  _stopProgressInterval() {
    if (this._progressInterval) { clearInterval(this._progressInterval); this._progressInterval = null; }
  }

  async _refreshUI() {
    if (!this._npMessage || !this.current) return;
    const { embed, components } = this._buildUI();
    try { await this._npMessage.edit({ embeds: [embed], components }); } catch (_) {}
  }

  _updateStatus() {
    if (!this.current) {
      this.client.user.setActivity('🎵 Type a song name!', { type: ActivityType.Listening });
    } else {
      this.client.user.setActivity(this.current.title, { type: ActivityType.Listening });
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  async addTrack(track) {
    this.tracks.push(track);
    if (!this.current) await this._playNext();
  }

  async _playNext() {
    clearTimeout(this._idleTimer);
    this._stopProgressInterval();
    if (this._destroyed) return;

    if (this.tracks.length === 0) {
      // Only autoplay if enabled
      if (this.autoplay && this.current) {
        const related = await this._findRelated();
        if (related) {
          console.log(`[Autoplay] Queuing: ${related.title}`);
          this.tracks.push(related);
        }
      }

      if (this.tracks.length === 0) {
        this.current = null;
        this._updateStatus();
        if (this._npMessage) {
          try { await this._npMessage.edit({ components: this._disableButtons(this._npMessage.components) }); } catch (_) {}
          this._npMessage = null;
        }
        this._idleTimer = setTimeout(() => this.destroy(), 2 * 60 * 1000);
        return;
      }
    }

    this.current = this.tracks.shift();
    this.paused  = false;

    this.history.unshift({ ...this.current });
    if (this.history.length > 20) this.history.pop();

    if (this.current._requesterId) {
      recordPlay(this.current, this.current._requesterId, this.current.requester);
    }

    try {
      await this.player.playTrack({ track: { encoded: this.current.encoded } });
      await this._sendNowPlaying();
      this._updateStatus();
      console.log(`[Playing] ${this.current.title}`);
    } catch (err) {
      console.error(`[Play Error] ${err.message}`);
      this.textChannel.send(`❌ Could not play **${this.current.title}** — skipping.`).catch(() => {});
      this._playNext();
    }
  }

  async _findRelated() {
    if (!this.current) return null;

    try {
      const node = this.client.shoukaku.getIdealNode();
      if (!node) return null;

      // Clean current title heavily
      const clean = this.current.title
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/ft\..*|feat\..*/gi, '')
        .replace(/official.*|video.*/gi, '')
        .replace(/slowed.*|reverb.*|nightcore.*|sped up.*/gi, '')
        .replace(/lyrics?.*/gi, '')
        .trim();

      // Extract likely artist
      let artist = '';

      if (clean.includes(' - ')) {
        artist = clean.split(' - ')[0].trim();
      } else {
        artist = clean.split(' ').slice(0, 2).join(' ');
      }

      // Rotate autoplay discovery strategies
      const queries = [
        // Same artist sometimes
        `${artist} official audio`,
        `${artist} music`,

        // Similar vibe
        `songs like ${clean}`,
        `music similar to ${clean}`,
        `songs similar to ${clean}`,

        // Broader discovery
        `best pop songs`,
        `best chill songs`,
        `recommended songs like ${clean}`,
      ];

      // Rotate based on history count
      const query = queries[Math.floor(Math.random() * queries.length)];

      console.log(`[Autoplay] Searching: ${query}`);

      const result = await node.rest.resolve(`ytsearch:${query}`);

      if (result?.loadType !== 'search' || !result.data?.length) {
        return null;
      }

      // Avoid repeats and same-title variants
      const historyUris = new Set(this.history.map(t => t.uri));

      const normalize = str =>
        str
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const currentNormalized = normalize(clean);

      const pick = result.data.find(t => {
        const title = t.info.title.toLowerCase();

        // Skip same URI
        if (t.info.uri === this.current.uri) return false;

        // Skip already played
        if (historyUris.has(t.info.uri)) return false;

        // Skip titles too similar to current song
        const normalizedTitle = normalize(title);

        // Reject if title contains original song name
        if (
          normalizedTitle.includes(currentNormalized) ||
          currentNormalized.includes(normalizedTitle)
        ) {
          return false;
        }

        // Skip remix/slowed/etc
        if (
          title.includes('slowed') ||
          title.includes('reverb') ||
          title.includes('nightcore') ||
          title.includes('sped up') ||
          title.includes('remix')
        ) {
          return false;
        }

         if (
          title.includes('mix') ||
          title.includes('playlist') ||
          title.includes('compilation') ||
          title.includes('greatest hits') ||
          title.includes('full album') ||
          title.includes('1 hour') ||
          title.includes('live stream')
        ) {
          return false;
        }
        
        if (durationMs > 8 * 60 * 1000) {
          return false;
        }

        return true;
      });

      if (!pick) return null;

      return {
        encoded: pick.encoded,
        title: pick.info.title,
        uri: pick.info.uri,
        duration: fmt(pick.info.length),
        durationMs: pick.info.length,
        thumbnail: pick.info.artworkUrl || null,
        requester: '🤖 Autoplay',
        _requesterId: null,
        _autoplay: true,
      };

    } catch (err) {
      console.error('[Autoplay Error]', err.message);
      return null;
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  async toggleAutoplay() {
    this.autoplay = !this.autoplay;
    await this._refreshUI();
    return this.autoplay;
  }

  async replay() {
    if (!this.current) return;
    this.tracks.unshift({ ...this.current });
    this.player.stopTrack();
  }

  skip() { this.player.stopTrack(); }

  async skipTo(position) {
    if (position < 1 || position > this.tracks.length) return false;
    this.tracks.splice(0, position - 1);
    this.player.stopTrack();
    return true;
  }

  async seek(ms) {
    await this.player.seekTo(ms);
    await this._refreshUI();
  }

  async pause() {
    this.player.setPaused(true);
    this.paused = true;
    await this._refreshUI();
  }

  async resume() {
    this.player.setPaused(false);
    this.paused = false;
    await this._refreshUI();
  }

  async toggleLoop() {
    if      (!this.loop && !this.loopQueue) this.loop = true;
    else if (this.loop)                     { this.loop = false; this.loopQueue = true; }
    else                                    this.loopQueue = false;
    await this._refreshUI();
  }

  async shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    await this._refreshUI();
  }

  async setVolume(vol) {
    this.volume = Math.max(1, Math.min(100, vol));
    await this.player.setGlobalVolume(this.volume);
    await this._refreshUI();
  }

  stop() { this.tracks = []; this.current = null; this.player.stopTrack(); }

  _cleanup() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._stopProgressInterval();
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this._updateStatus();
    this.client.queues.delete(this.guildId);
    this.client.shoukaku.connections.delete(this.guildId);
    this.client.shoukaku.players.delete(this.guildId);
    if (this._npMessage) {
      this._npMessage.edit({ components: this._disableButtons(this._npMessage.components) }).catch(() => {});
      this._npMessage = null;
    }
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._stopProgressInterval();
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this._updateStatus();
    this.client.queues.delete(this.guildId);
    if (this._npMessage) {
      this._npMessage.edit({ components: this._disableButtons(this._npMessage.components) }).catch(() => {});
      this._npMessage = null;
    }
    try { await this.client.shoukaku.leaveVoiceChannel(this.guildId); } catch (_) {
      this.client.shoukaku.connections.delete(this.guildId);
      this.client.shoukaku.players.delete(this.guildId);
    }
  }
}

module.exports = { MusicQueue, fmt };