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

      // ---------- CLEAN TITLE ----------
      const clean = this.current.title
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/ft\..*|feat\..*/gi, '')
        .replace(/official.*|video.*/gi, '')
        .replace(/slowed.*|reverb.*|nightcore.*|sped up.*/gi, '')
        .replace(/lyrics?.*/gi, '')
        .trim();

      // ---------- LANGUAGE DETECTION ----------
      const detectLanguage = (text) => {
        if (/[ -]/.test(text) && /[\u0600-\u06FF]/.test(text)) return 'ar';
        if (/\b(que|como|para|porque|muy|mas|más|hola|adios|canción|canciones|esta|estas|esta|está)\b/i.test(text) || /[ñáéíóúü¿¡]/i.test(text)) return 'es';
        if (/[àâçéèêëîïôûùœæ]/i.test(text)) return 'fr';
        return 'other';
      };

      const currentLang = detectLanguage(this.current.title);

      // ---------- ARTIST / SONG TITLE EXTRACTION ----------
      const splitTrack = (text) => {
        const cleaned = text
          .replace(/\s*\|\s*/g, ' - ')
          .replace(/\s*:\s*/g, ' - ')
          .trim();

        const byMatch = cleaned.match(/(.+?)\s+by\s+(.+)/i);
        if (byMatch) {
          return { artist: byMatch[2].trim(), title: byMatch[1].trim() };
        }

        const parts = cleaned.split(' - ');
        if (parts.length >= 2) {
          return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
        }

        const words = cleaned.split(' ');
        return { artist: words.slice(0, 2).join(' ').trim(), title: cleaned };
      };

      const { artist, title: songTitle } = splitTrack(clean);

      // ---------- NORMALIZER ----------
      const normalize = (str) =>
        str
          .toLowerCase()
          .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      // ---------- FINGERPRINT (song-family detection) ----------
      const fingerprint = (str) =>
        normalize(str)
          .replace(/\b(remix|official|video|audio|lyrics|letra|version|edit|live|ft|feat|cover|explicit|hd|mv|mv|mashup|loop|transition|muffled|perfect|ending|best part|blind|audition|voice|kids|france|belgique|the voice|easy lyrics|english translation|with audio)\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const currentFp = fingerprint(this.current.title);

      this.historyFp = this.historyFp || new Set();
      this.artistCount = this.artistCount || new Map();

      // ---------- ESCAPE CONTROL ----------
      this.autoplayStep = (this.autoplayStep || 0) + 1;
      const forceEscape = this.autoplayStep % 6 === 0;

      this.clusterLock = this.clusterLock || { artist: null, count: 0 };

      const authorNow = (this.current.author || artist || '').toLowerCase();

      if (this.clusterLock.artist !== authorNow) {
        this.clusterLock.artist = authorNow;
        this.clusterLock.count = 0;
      }

      // ---------- QUERY SYSTEM (LANGUAGE AWARE) ----------
      const baseSearch = `${songTitle}${artist ? ' ' + artist : ''}`.trim();
      const genericQuery = `${baseSearch} similar songs`.trim();
      let query = '';

      if (forceEscape || this.clusterLock.count > 3 || !baseSearch) {
        query = 'global trending music 2026';
      } else if (currentLang === 'ar') {
        query = `أغاني مشابهة لـ ${baseSearch}`;
      } else if (currentLang === 'es') {
        query = `canciones similares a ${baseSearch}`;
      } else if (currentLang === 'fr') {
        query = `chansons similaires à ${baseSearch}`;
      } else {
        query = genericQuery;
      }

      console.log(`[Autoplay] Searching: ${query}`);

      let result = await node.rest.resolve(`ytsearch:${query}`);
      if ((!result || result.loadType !== 'search' || !result.data?.length) && baseSearch) {
        result = await node.rest.resolve(`ytsearch:${genericQuery}`);
      }
      if ((!result || result.loadType !== 'search' || !result.data?.length) && baseSearch) {
        result = await node.rest.resolve(`ytsearch:${baseSearch}`);
      }

      if (result?.loadType !== 'search' || !result.data?.length) {
        return null;
      }

      const historyIds = new Set(
        this.history.map(t => t.identifier || t.uri)
      );

      const similarity = (a, b) => {
        const setA = new Set(a.split(' '));
        const setB = new Set(b.split(' '));
        const intersection = [...setA].filter(x => setB.has(x));
        return intersection.length / Math.max(setA.size, setB.size);
      };

      // ---------- SCORING ----------
      const scored = result.data
        .filter(t => {
          const title = normalize(t.info.title);
          const fp = fingerprint(t.info.title);
          const lang = detectLanguage(t.info.title);

          if (t.info.uri === this.current.uri) return false;

          if (historyIds.has(t.info.identifier || t.info.uri)) return false;

          // prevent same song family loop
          if (this.historyFp.has(fp)) return false;
          if (fp === currentFp) return false;
          if (fp.includes(currentFp) || currentFp.includes(fp)) return false;

          // keep language consistency
          if (!forceEscape) {
            if (lang !== currentLang) return false;
          }

          if (similarity(title, normalize(this.current.title)) > 0.5) {
            return false;
          }

          // remove junk variants
          if (
            title.includes('remix') ||
            title.includes('slowed') ||
            title.includes('reverb') ||
            title.includes('nightcore') ||
            title.includes('sped up') ||
            title.includes('mix') ||
            title.includes('playlist') ||
            title.includes('compilation') ||
            title.includes('1 hour') ||
            title.includes('live') ||
            title.includes('lyrics') ||
            title.includes('letra') ||
            title.includes('mashup') ||
            title.includes('cover') ||
            title.includes('edit') ||
            title.includes('loop') ||
            title.includes('transition') ||
            title.includes('muffled') ||
            title.includes('perfect') ||
            title.includes('ending') ||
            title.includes('best part') ||
            title.includes('blind') ||
            title.includes('audition') ||
            title.includes('voice') ||
            title.includes('kids') ||
            title.includes('easy lyrics') ||
            title.includes('english translation') ||
            title.includes('with audio')
          ) return false;

          // avoid same song variants
          const currentNorm = normalize(this.current.title);
          const candidateNorm = title;
          if (currentNorm.includes(candidateNorm) || candidateNorm.includes(currentNorm)) {
            return false;
          }

          // avoid exact same song title (different artists/versions)
          const currentSongTitle = normalize(songTitle);
          const candidateSongTitle = normalize(splitTrack(t.info.title).title);
          if (currentSongTitle === candidateSongTitle) {
            return false;
          }

          if ((t.info.length || 0) > 8 * 60 * 1000) return false;

          return true;
        })
        .map(t => {
          const title = normalize(t.info.title);
          const fp = fingerprint(t.info.title);
          const lang = detectLanguage(t.info.title);
          const author = (t.info.author || 'unknown').toLowerCase();

          const artistCount = this.artistCount.get(author) || 0;

          let score = 100;

          // same language boost
          if (lang === currentLang) score += 40;

          // same artist moderate boost
          if (author.includes(artist.toLowerCase())) score += 20;

          // penalize repetition
          score -= artistCount * 25;

          // penalize cluster repetition
          if (this.clusterLock.artist === author) {
            score -= 40;
          }

          // penalize high similarity (variants)
          const sim = similarity(title, normalize(this.current.title));
          if (sim > 0.3) score -= sim * 200; // heavy penalty for similar titles

          return { t, score, fp, lang };
        })
        .sort((a, b) => b.score - a.score);

      const pick = scored[0]?.t;

      if (!pick) return null;

      // ---------- UPDATE MEMORY ----------
      const pickedFp = fingerprint(pick.info.title);
      const pickedAuthor = (pick.info.author || 'unknown').toLowerCase();

      this.historyFp.add(pickedFp);

      this.artistCount.set(
        pickedAuthor,
        (this.artistCount.get(pickedAuthor) || 0) + 1
      );

      this.clusterLock.count++;

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