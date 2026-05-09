// queue/MusicQueue.js
const { EmbedBuilder } = require('discord.js');

class MusicQueue {
  constructor(guildId, textChannel, player, client) {
    this.guildId     = guildId;
    this.textChannel = textChannel;
    this.player      = player;
    this.client      = client;
    this.tracks      = [];
    this.current     = null;
    this.paused      = false;
    this._idleTimer  = null;
    this._destroyed  = false;

    this.player.on('end', data => {
      if (data.reason === 'replaced') return;
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

    // Fired when Discord disconnects the bot externally (kicked from VC, etc.)
    this.player.on('closed', () => {
      console.warn(`[Player] Closed for guild ${this.guildId} — cleaning up.`);
      this._cleanup();
    });
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
      this._idleTimer = setTimeout(() => this.destroy(), 2 * 60 * 1000);
      return;
    }

    this.current = this.tracks.shift();
    this.paused  = false;

    try {
      await this.player.playTrack({ track: { encoded: this.current.encoded } });
      this._sendNowPlaying();
      console.log(`[Playing] ${this.current.title}`);
    } catch (err) {
      console.error(`[Play Error] ${err.message}`);
      this.textChannel.send(`❌ Could not play **${this.current.title}** — skipping.`).catch(() => {});
      this._playNext();
    }
  }

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

  skip()   { this.player.stopTrack(); }
  pause()  { this.player.setPaused(true);  this.paused = true;  }
  resume() { this.player.setPaused(false); this.paused = false; }

  // Called when bot is kicked / VC closed externally — no leaveVoiceChannel needed
  _cleanup() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this.client.queues.delete(this.guildId);
    // Shoukaku already knows the connection is gone — just clear its maps
    this.client.shoukaku.connections.delete(this.guildId);
    this.client.shoukaku.players.delete(this.guildId);
  }

  // Called by /stop command or idle timeout — need to actively leave VC
  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._idleTimer);
    this.tracks  = [];
    this.current = null;
    this.client.queues.delete(this.guildId);
    // leaveVoiceChannel cleans BOTH shoukaku.connections and shoukaku.players
    try {
      await this.client.shoukaku.leaveVoiceChannel(this.guildId);
    } catch (err) {
      console.warn('[Destroy] leaveVoiceChannel error:', err.message);
      // Fallback: manually clear both maps
      this.client.shoukaku.connections.delete(this.guildId);
      this.client.shoukaku.players.delete(this.guildId);
    }
  }
}

module.exports = MusicQueue;
