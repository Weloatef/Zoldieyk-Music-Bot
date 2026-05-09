// queue/QueueManager.js

const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  StreamType,
} = require('@discordjs/voice');
const { execFile, spawn } = require('child_process');
const { promisify }       = require('util');
const path                = require('path');

const execFileAsync = promisify(execFile);

// Railway (Linux) uses system binaries installed via nixpacks.toml
const YTDLP_PATH  = 'yt-dlp';
const FFMPEG_PATH = 'ffmpeg';

const queues = new Map();

class MusicQueue {
  constructor(guildId, textChannel) {
    this.guildId     = guildId;
    this.textChannel = textChannel;
    this.connection  = null;
    this.player      = createAudioPlayer();
    this.tracks      = [];
    this.current     = null;
    this.loop        = false;
    this.paused      = false;

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.loop && this.current) this.tracks.unshift(this.current);
      this._playNext();
    });

    this.player.on('error', err => {
      console.error(`[Player Error] ${err.message}`);
      this.textChannel.send('Warning: Playback error, skipping...');
      this._playNext();
    });
  }

  async join(voiceChannel) {
    if (
      this.connection &&
      this.connection.joinConfig.channelId === voiceChannel.id
    ) return;

    if (this.connection) this.connection.destroy();

    this.connection = joinVoiceChannel({
      channelId     : voiceChannel.id,
      guildId       : voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf      : true,
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    this.connection.subscribe(this.player);

    // Wait for ready — on Railway this should be fast (no UDP firewall)
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
      console.log('[VC] Ready');
    } catch {
      console.error('[VC] Failed to become ready');
      this.textChannel.send('❌ Could not connect to the voice channel.');
      this.destroy();
      throw new Error('VC not ready');
    }
  }

  async addTrack(track) {
    if (!track) return;
    this.tracks.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this._playNext();
    }
  }

  async _playNext() {
    if (this.tracks.length === 0) {
      this.current = null;
      setTimeout(() => {
        if (this.player.state.status === AudioPlayerStatus.Idle) this.destroy();
      }, 120_000);
      return;
    }

    this.current = this.tracks.shift();
    console.log(`[Playing] ${this.current.title}`);

    try {
      // Step 1: get direct audio URL via yt-dlp
      const { stdout } = await execFileAsync(YTDLP_PATH, [
        this.current.url,
        '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
        '--get-url',
        '--no-playlist',
      ]);

      const streamUrl = stdout.trim().split('\n')[0];
      if (!streamUrl) throw new Error('No stream URL returned');
      console.log('[Stream URL obtained]');

      // Step 2: pipe stream URL through ffmpeg → opus → discord
      // On Linux pipes work correctly, no temp file needed
      const ffmpeg = spawn(FFMPEG_PATH, [
        '-reconnect',           '1',
        '-reconnect_streamed',  '1',
        '-reconnect_delay_max', '5',
        '-i',                   streamUrl,
        '-vn',
        '-acodec',              'libopus',
        '-f',                   'opus',
        '-ar',                  '48000',
        '-ac',                  '2',
        '-b:a',                 '128k',
        'pipe:1',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      ffmpeg.stderr.on('data', d => {
        const msg = d.toString().trim();
        if (msg.toLowerCase().includes('error')) console.error('[ffmpeg]', msg);
      });

      ffmpeg.on('error', err => {
        console.error('[ffmpeg spawn]', err.message);
        this.textChannel.send(`❌ ffmpeg error — skipping.`);
        this._playNext();
      });

      ffmpeg.on('close', code => {
        if (code !== 0) console.warn(`[ffmpeg] exited with code ${code}`);
      });

      const resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.OggOpus,
      });

      this.player.play(resource);
      this.sendNowPlaying();

    } catch (err) {
      console.error(`[Stream Error] ${err.message}`);
      this.textChannel.send(`❌ Could not stream **${this.current.title}** — skipping.`);
      this._playNext();
    }
  }

  sendNowPlaying() {
    if (!this.current) return;
    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${this.current.title}](${this.current.url})**`)
      .addFields(
        { name: 'Duration',     value: this.current.duration  || 'Unknown', inline: true },
        { name: 'Requested by', value: this.current.requester || 'Unknown', inline: true },
        { name: 'Queue',        value: `${this.tracks.length} song(s) remaining`, inline: true }
      )
      .setThumbnail(this.current.thumbnail || null)
      .setFooter({ text: 'Type a song name to add more | /skip /queue /stop' });

    this.textChannel.send({ embeds: [embed] });
  }

  skip()   { this.player.stop(true); }
  pause()  { this.player.pause();    this.paused = true;  }
  resume() { this.player.unpause();  this.paused = false; }
  stop()   { this.tracks = []; this.current = null; this.player.stop(true); }

  destroy() {
    this.player.stop(true);
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
    queues.delete(this.guildId);
  }
}

function getQueue(guildId)             { return queues.get(guildId) || null; }
function createQueue(guildId, ch)      { const q = new MusicQueue(guildId, ch); queues.set(guildId, q); return q; }
function getOrCreateQueue(guildId, ch) { return getQueue(guildId) || createQueue(guildId, ch); }

module.exports = { getQueue, createQueue, getOrCreateQueue };