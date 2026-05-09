// queue/MusicQueue.js
// Per-guild queue manager that uses a Shoukaku (Lavalink) player.
// Audio streams over WebSocket — no UDP, works on Railway/Render.

const { EmbedBuilder } = require('discord.js');

class MusicQueue {
  /**
   * @param {string}         guildId
   * @param {TextChannel}    textChannel
   * @param {ShoukakuPlayer} player       — Shoukaku player already connected to VC
   */
  constructor(guildId, textChannel, player, client) {
    this.guildId     = guildId;
    this.textChannel = textChannel;
    this.player      = player;
    this.client      = client; // stored so idle-timeout can clean both maps
    this.tracks      = [];   // upcoming tracks
    this.current     = null; // currently playing track
    this.paused      = false;
    this._idleTimer  = null;

    // ── Wire Shoukaku player events ─────────────────────────────────────────
    this.player.on('end', data => {
      // 'REPLACED' means skip/stop was called — don't auto-advance
      if (data.reason === 'replaced') return;
      this._playNext();
    });

    this.player.on('exception', err => {
      console.error(`[Player Exception] ${err?.message || err}`);
      this.textChannel.send('⚠️ Playback error — skipping to next track.');
      this._playNext();
    });

    this.player.on('stuck', () => {
      console.warn('[Player Stuck] Track got stuck, skipping.');
      this.textChannel.send('⚠️ Track got stuck — skipping.');
      this._playNext();
    });

    this.player.on('closed', () => {
      console.warn('[Player] WebSocket closed unexpectedly.');
    });
  }

  // ── Add a track and start playing if idle ──────────────────────────────────
  async addTrack(track) {
    this.tracks.push(track);
    if (!this.current) {
      await this._playNext();
    }
  }

  // ── Internal: pop next track and play it ───────────────────────────────────
  async _playNext() {
    clearTimeout(this._idleTimer);

    if (this.tracks.length === 0) {
      this.current = null;
      // Auto-disconnect after 2 minutes of silence
      this._idleTimer = setTimeout(() => this.destroy(this.client), 2 * 60 * 1000);
      return;
    }

    this.current = this.tracks.shift();
    this.paused  = false;

    try {
      // player.playTrack expects the base64 track string from Lavalink search
      await this.player.playTrack({ track: { encoded: this.current.encoded } });
      this._sendNowPlaying();
      console.log(`[Playing] ${this.current.title}`);
    } catch (err) {
      console.error(`[Play Error] ${err.message}`);
      this.textChannel.send(`❌ Could not play **${this.current.title}** — skipping.`);
      this._playNext();
    }
  }

  // ── "Now Playing" embed ────────────────────────────────────────────────────
  _sendNowPlaying() {
    if (!this.current) return;
    const t = this.current;

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.uri})**`)
      .addFields(
        { name: 'Duration',     value: t.duration  || 'Unknown', inline: true },
        { name: 'Requested by', value: t.requester || 'Unknown', inline: true },
        { name: 'Queue',        value: `${this.tracks.length} song(s) remaining`, inline: true }
      )
      .setThumbnail(t.thumbnail || null)
      .setFooter({ text: 'Type a song name to add more  |  /skip /queue /stop' });

    this.textChannel.send({ embeds: [embed] }).catch(() => {});
  }

  // ── Playback controls ──────────────────────────────────────────────────────
  skip() {
    // Stopping with reason 'replaced' triggers 'end' which calls _playNext
    this.player.stopTrack();
  }

  pause() {
    this.player.setPaused(true);
    this.paused = true;
  }

  resume() {
    this.player.setPaused(false);
    this.paused = false;
  }

  stop() {
    this.tracks  = [];
    this.current = null;
    this.player.stopTrack();
  }

  // ── Clean up everything ────────────────────────────────────────────────────
  async destroy(client) {
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    try {
      await this.player.connection.disconnect();
    } catch (_) {}
    // Remove from Shoukaku's internal players map so the guild can rejoin later
    if (client) {
      client.shoukaku.players.delete(this.guildId);
      client.queues.delete(this.guildId);
    }
  }
}

module.exports = MusicQueue;
