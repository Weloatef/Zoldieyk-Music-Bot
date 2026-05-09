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
const fs                  = require('fs');
const path                = require('path');

const execFileAsync = promisify(execFile);

const YTDLP_PATH   = process.platform === 'win32'
  ? path.join(__dirname, '..', 'yt-dlp.exe')
  : path.join(__dirname, '..', 'yt-dlp');

const FFMPEG_PATH  = process.platform === 'win32'
  ? path.join(__dirname, '..', 'ffmpeg.exe')
  : 'ffmpeg';

const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');

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

    this.connection.subscribe(this.player);

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

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 60_000);
      console.log('[VC] Ready');
    } catch {
      console.warn('[VC] Did not reach Ready state in 60s — attempting playback anyway');
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
      // Build yt-dlp args with optional cookies
      const ytArgs = [
        this.current.url,
        '-f', 'bestaudio/best',
        '--get-url',
        '--no-playlist',
      ];
      if (fs.existsSync(COOKIES_PATH)) {
        ytArgs.push('--cookies', COOKIES_PATH);
      }

      const { stdout } = await execFileAsync(YTDLP_PATH, ytArgs);
      const streamUrl  = stdout.trim().split('\n')[0];
      if (!streamUrl) throw new Error('No stream URL returned');
      console.log('[Stream URL obtained]');

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