// queue/MusicQueue.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class MusicQueue {
  constructor(guildId, textChannel, player, client) {
    this.guildId        = guildId;
    this.textChannel    = textChannel;
    this.player         = player;
    this.client         = client;
    this.tracks         = [];
    this.current        = null;
    this.paused         = false;
    this.loop           = false;   // loop current song
    this.loopQueue      = false;   // loop entire queue
    this.volume         = 100;
    this._idleTimer     = null;
    this._destroyed     = false;
    this._npMessage     = null;    // the "Now Playing" message with buttons

    this.player.on('end', data => {
      if (data.reason === 'replaced') return;
      if (this.loop && this.current) this.tracks.unshift(this.current);
      else if (this.loopQueue && this.current) this.tracks.push(this.current);
      this._playNext();
    });

    this.player.on('exception', err => {
      console.error(`[Player Exception] ${err?.message || err}`);
      this.textChannel.send('⚠️ Playback error — skipping.').catch(() => {});
      this._playNext();
    });

    this.player.on('stuck', () => {
      console.warn('[Player Stuck] Skipping.');
      this._playNext();
    });

    this.player.on('closed', () => {
      console.warn(`[Player] Closed for guild ${this.guildId}`);
      this._cleanup();
    });
  }

  // ── Build the Now Playing embed + button rows ─────────────────────────────
  _buildNowPlayingUI() {
    const t = this.current;

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.uri})**`)
      .addFields(
        { name: 'Duration',     value: t.duration          || 'Unknown', inline: true },
        { name: 'Requested by', value: t.requester         || 'Unknown', inline: true },
        { name: 'Queue',        value: `${this.tracks.length} song(s)`,  inline: true },
        { name: 'Loop',         value: this.loop ? '🔁 Song' : this.loopQueue ? '🔁 Queue' : 'Off', inline: true },
        { name: 'Volume',       value: `🔊 ${this.volume}%`, inline: true },
      )
      .setThumbnail(t.thumbnail || null)
      .setFooter({ text: 'Use the buttons below or type a song name to queue more' });

    // Row 1 — main playback controls
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_replay')
        .setEmoji('⏮')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setEmoji(this.paused ? '▶️' : '⏸')
        .setStyle(this.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setEmoji('⏭')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_loop')
        .setEmoji('🔁')
        .setStyle(this.loop || this.loopQueue ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_shuffle')
        .setEmoji('🔀')
        .setStyle(ButtonStyle.Secondary),
    );

    // Row 2 — volume + queue + stop
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_voldown')
        .setEmoji('🔉')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_queue')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setEmoji('⏹')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('music_volup')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Secondary),
    );

    return { embed, components: [row1, row2] };
  }

  // ── Send or update the Now Playing message ────────────────────────────────
  async _sendNowPlaying() {
    const { embed, components } = this._buildNowPlayingUI();

    // Disable buttons on the old message so only the latest is interactive
    if (this._npMessage) {
      try {
        await this._npMessage.edit({ components: _disabledComponents(this._npMessage.components) });
      } catch (_) {}
    }

    this._npMessage = await this.textChannel.send({ embeds: [embed], components }).catch(() => null);
  }

  // ── Refresh buttons on the current Now Playing message (no new message) ──
  async _refreshUI() {
    if (!this._npMessage || !this.current) return;
    const { embed, components } = this._buildNowPlayingUI();
    try {
      await this._npMessage.edit({ embeds: [embed], components });
    } catch (_) {}
  }

  async addTrack(track) {
    this.tracks.push(track);
    if (!this.current) await this._playNext();
  }

  async _playNext() {
    clearTimeout(this._idleTimer);
    if (this._destroyed) return;

    if (this.tracks.length === 0) {
      this.current = null;
      // Disable buttons on the last NP message
      if (this._npMessage) {
        try {
          await this._npMessage.edit({ components: _disabledComponents(this._npMessage.components) });
        } catch (_) {}
        this._npMessage = null;
      }
      this._idleTimer = setTimeout(() => this.destroy(), 2 * 60 * 1000);
      return;
    }

    this.current = this.tracks.shift();
    this.paused  = false;

    try {
      await this.player.playTrack({ track: { encoded: this.current.encoded } });
      await this._sendNowPlaying();
      console.log(`[Playing] ${this.current.title}`);
    } catch (err) {
      console.error(`[Play Error] ${err.message}`);
      this.textChannel.send(`❌ Could not play **${this.current.title}** — skipping.`).catch(() => {});
      this._playNext();
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  async replay() {
    if (!this.current) return;
    this.tracks.unshift(this.current);
    this.player.stopTrack();
  }

  skip() { this.player.stopTrack(); }

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
    if (!this.loop && !this.loopQueue) {
      this.loop = true;            // off → loop song
    } else if (this.loop) {
      this.loop = false;
      this.loopQueue = true;       // loop song → loop queue
    } else {
      this.loopQueue = false;      // loop queue → off
    }
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

  stop() {
    this.tracks  = [];
    this.current = null;
    this.player.stopTrack();
  }

  _cleanup() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this.client.queues.delete(this.guildId);
    this.client.shoukaku.connections.delete(this.guildId);
    this.client.shoukaku.players.delete(this.guildId);
    if (this._npMessage) {
      this._npMessage.edit({ components: _disabledComponents(this._npMessage.components) }).catch(() => {});
      this._npMessage = null;
    }
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this.client.queues.delete(this.guildId);
    if (this._npMessage) {
      this._npMessage.edit({ components: _disabledComponents(this._npMessage.components) }).catch(() => {});
      this._npMessage = null;
    }
    try {
      await this.client.shoukaku.leaveVoiceChannel(this.guildId);
    } catch (_) {
      this.client.shoukaku.connections.delete(this.guildId);
      this.client.shoukaku.players.delete(this.guildId);
    }
  }
}

// Helper: return greyed-out disabled version of existing button rows
function _disabledComponents(rows) {
  return rows.map(row => {
    const newRow = new ActionRowBuilder();
    newRow.addComponents(
      row.components.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true)
      )
    );
    return newRow;
  });
}

module.exports = MusicQueue;