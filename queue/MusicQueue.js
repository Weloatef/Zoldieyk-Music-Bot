// queue/MusicQueue.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const { recordPlay } = require('../music/stats');

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  Language detection  (fixed: Arabic only needs Arabic chars, not dash+space)
// ─────────────────────────────────────────────────────────────────────────────
function detectLanguage(text) {
  if (/[\u0600-\u06FF]/.test(text))  return 'ar';   // Arabic script → Arabic
  if (/[\u0590-\u05FF]/.test(text))  return 'he';   // Hebrew
  if (/[\u0400-\u04FF]/.test(text))  return 'ru';   // Cyrillic
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) return 'ja'; // Japanese/Chinese
  if (/[\uAC00-\uD7A3]/.test(text))  return 'ko';   // Korean
  // Latin-script language hints
  if (/\b(que|como|para|porque|muy|canción|canciones|está|también|ellos)\b/i.test(text)
    || /[ñáéíóúü¿¡]/i.test(text))    return 'es';
  if (/\b(les|des|une|dans|avec|pour|plus|comme|sur|vous)\b/i.test(text)
    || /[àâçéèêëîïôûùœæ]/i.test(text)) return 'fr';
  if (/\b(und|der|die|das|mit|von|auf|ich|ein|ist)\b/i.test(text)) return 'de';
  if (/\b(che|con|della|degli|sono|questo|quella)\b/i.test(text)) return 'it';
  if (/\b(الله|انا|انت|لما|ليه|مش|عشان|بتاع|خليك|لو|عيني)\b/i.test(text)) return 'ar'; // Egyptian dialect
  return 'en';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Title cleaning & splitting
// ─────────────────────────────────────────────────────────────────────────────
function cleanTitle(title) {
  return title
    .replace(/\(.*?\)|\[.*?\]/g, '')           // remove parenthetical & bracketed
    .replace(/ft\..*|feat\..*/gi, '')           // featuring
    .replace(/\b(official|video|audio|lyrics?|letra|hd|4k|clip|mv)\b.*/gi, '')
    .replace(/\b(slowed|reverb|nightcore|sped up|speed up)\b.*/gi, '')
    .replace(/\s*[-|:]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract { artist, songTitle } from a cleaned title string
function splitTrack(text) {
  // "Artist - Song" format (most common on YouTube)
  const dashParts = text.split(/\s+-\s+/);
  if (dashParts.length >= 2) {
    return { artist: dashParts[0].trim(), songTitle: dashParts.slice(1).join(' ').trim() };
  }
  // "Song by Artist"
  const byMatch = text.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) return { artist: byMatch[2].trim(), songTitle: byMatch[1].trim() };

  // No separator — treat whole text as song title, no artist known
  return { artist: '', songTitle: text.trim() };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Normalize & fingerprint
// ─────────────────────────────────────────────────────────────────────────────
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F\u0600-\u06FF\u0400-\u04FF\uAC00-\uD7A3]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strips metadata words to get the "core" song identity for dupe detection
const FP_STRIP = /\b(remix|official|video|audio|lyrics?|letra|version|edit|live|ft|feat|cover|explicit|hd|mv|mashup|loop|transition|muffled|perfect|ending|best part|blind|audition|kids|france|belgique|easy|english translation|with audio|visualizer|lyric video|music video|extended|remaster|remastered|acoustic|unplugged|instrumental|karaoke|tribute|parody|reaction|review|analysis|commentary|explained|interview|behind the scenes|making of|recording|session|studio|performance|concert|tour|festival|showcase|premiere|debut|release|new|2020|2021|2022|2023|2024|2025|2026)\b/g;

function fingerprint(title) {
  return normalize(title).replace(FP_STRIP, '').replace(/\s+/g, ' ').trim();
}

// Word-overlap similarity [0..1]
function similarity(a, b) {
  const setA = new Set(a.split(' ').filter(w => w.length > 2));
  const setB = new Set(b.split(' ').filter(w => w.length > 2));
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(x => setB.has(x));
  return intersection.length / Math.max(setA.size, setB.size);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hard blocklist — titles containing ANY of these strings are rejected
//  (applied after normalize, so lowercase)
// ─────────────────────────────────────────────────────────────────────────────
const HARD_BLOCK = [
  'playlist', 'compilation', 'mix', 'megamix', 'medley',
  'slowed', 'reverb', 'nightcore', 'sped up', 'speed up',
  'lyrics', 'lyric video', 'letra', 'كلمات',
  'live', 'concert', 'tour', 'performance', 'session',
  'cover', 'tribute', 'parody', 'karaoke', 'instrumental',
  'reaction', 'review', 'explained', 'analysis', 'commentary',
  'interview', 'behind the scenes', 'making of', 'recording',
  'mashup', 'loop', 'transition', 'muffled',
  'best part', 'ending', 'intro', 'outro',
  'blind audition', 'the voice', 'got talent', 'idol',
  'easy', 'kids', 'children', 'nursery',
  'english translation', 'with audio', 'visualizer',
  'acoustic', 'unplugged',
  '1 hour', 'hour loop', 'hours',
  'شيلة', 'شيله',        // Arabic nasheed/tribal chant (very different vibe)
  'أنشودة', 'نشيد',      // Arabic religious chant
];

function isBlocked(normalizedTitle) {
  return HARD_BLOCK.some(word => normalizedTitle.includes(word));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Language-aware query builder
//  Returns an array of queries to try in order (first non-empty result wins)
// ─────────────────────────────────────────────────────────────────────────────
function buildQueries(artist, songTitle, lang, escape) {
  const base = artist ? `${artist} ${songTitle}` : songTitle;

  if (escape) {
    // Forced genre escape — still language-consistent
    const escapeMap = {
      ar: `أحسن أغاني عربية 2024 2025`,
      he: `שירים ישראלים פופולריים`,
      ru: `лучшие российские хиты`,
      ja: `人気の日本語の曲`,
      ko: `인기 한국 노래`,
      es: `mejores canciones en español pop`,
      fr: `meilleures chansons françaises pop`,
      de: `beste deutsche Musik Pop`,
      it: `migliori canzoni italiane pop`,
      en: `popular english songs similar to ${base}`,
    };
    return [escapeMap[lang] || `popular music ${lang}`];
  }

  const map = {
    ar: [
      `${base} أغاني مشابهة`,           // "similar songs" in Arabic
      `${artist || songTitle} اغاني`,    // just artist + "songs"
      `أغاني عربية مشابهة ${songTitle}`, // Arabic songs similar to [song]
    ],
    he: [`${base} שירים דומים`, `${artist} שירים`],
    ru: [`${base} похожие песни`, `${artist} лучшие песни`],
    ja: [`${base} 似た曲`, `${artist} 人気曲`],
    ko: [`${base} 비슷한 노래`, `${artist} 노래`],
    es: [`${base} canciones similares`, `${artist} canciones populares`],
    fr: [`${base} chansons similaires`, `${artist} meilleures chansons`],
    de: [`${base} ähnliche Lieder`, `${artist} beste Songs`],
    it: [`${base} canzoni simili`, `${artist} canzoni popolari`],
    en: [
      `${base} similar songs`,
      artist ? `${artist} popular songs` : `${songTitle} related`,
    ],
  };

  return (map[lang] || map.en).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MusicQueue class
// ─────────────────────────────────────────────────────────────────────────────
class MusicQueue {
  constructor(guildId, textChannel, player, client) {
    this.guildId     = guildId;
    this.textChannel = textChannel;
    this.player      = player;
    this.client      = client;
    this.tracks      = [];
    this.history     = [];    // full track objects, last 30
    this.current     = null;
    this.paused      = false;
    this.loop        = false;
    this.loopQueue   = false;
    this.autoplay    = true;
    this.volume      = 100;
    this._idleTimer  = null;
    this._destroyed  = false;
    this._npMessage  = null;
    this._progressInterval = null;

    // Autoplay memory — persists for the whole session
    this._seenUris    = new Set();   // all URIs ever played/queued
    this._seenFps     = new Set();   // fingerprints of played songs
    this._artistCount = new Map();   // author → play count
    this._autoStep    = 0;           // increments each autoplay pick

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

    this.player.on('stuck',  () => { console.warn('[Stuck]'); this._playNext(); });
    this.player.on('closed', () => { console.warn(`[Player] Closed — guild ${this.guildId}`); this._cleanup(); });
    this.player.on('update', () => {});
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
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
        { name: 'Requested by', value: t.requester            || 'Unknown',               inline: true },
        { name: 'Queue',        value: `${this.tracks.length} song(s)`,                   inline: true },
        { name: 'Loop',         value: this.loop ? '🔁 Song' : this.loopQueue ? '🔁 Queue' : 'Off', inline: true },
        { name: 'Volume',       value: `🔊 ${this.volume}%`,                               inline: true },
        { name: 'Autoplay',     value: this.autoplay ? '🔄 On' : '⏹ Off',                 inline: true },
      )
      .setThumbnail(t.thumbnail || null)
      .setFooter({ text: 'Type a song name to queue more' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_replay')  .setEmoji('⏮').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_pause')   .setEmoji(this.paused ? '▶️' : '⏸').setStyle(this.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip')    .setEmoji('⏭').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_loop')    .setEmoji('🔁').setStyle(this.loop || this.loopQueue ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_shuffle') .setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown') .setEmoji('🔉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_queue')   .setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop')    .setEmoji('⏹').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_volup')   .setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_autoplay').setEmoji('🔄').setStyle(this.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
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
    try {
      if (!this.current) {
        this.client.user.setActivity('🎵 Type a song name!', { type: ActivityType.Listening });
      } else {
        this.client.user.setActivity(this.current.title, { type: ActivityType.Listening });
      }
    } catch (_) {}
  }

  // ── Queue management ────────────────────────────────────────────────────────
  async addTrack(track) {
    // Register URI in seen set so autoplay never re-queues user-requested songs
    if (track.uri) this._seenUris.add(track.uri);
    if (track.uri) this._seenFps.add(fingerprint(track.title));
    this.tracks.push(track);
    if (!this.current) await this._playNext();
  }

  async _playNext() {
    clearTimeout(this._idleTimer);
    this._stopProgressInterval();
    if (this._destroyed) return;

    if (this.tracks.length === 0) {
      if (this.autoplay && this.current) {
        const related = await this._findRelated();
        if (related) {
          console.log(`[Autoplay] ✅ Queuing: ${related.title}`);
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

    // Track in history (use URI as the canonical ID)
    this.history.unshift({ ...this.current });
    if (this.history.length > 30) this.history.pop();

    // Register in seen sets
    if (this.current.uri) this._seenUris.add(this.current.uri);
    if (this.current.title) this._seenFps.add(fingerprint(this.current.title));

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

  // ── Autoplay: find a related song ───────────────────────────────────────────
  async _findRelated() {
    if (!this.current) return null;

    const MAX_SEARCH_MS = 8_000; // hard timeout so we never hang
    const searchDeadline = Date.now() + MAX_SEARCH_MS;

    try {
      const node = this.client.shoukaku.getIdealNode();
      if (!node) return null;

      const lang      = detectLanguage(this.current.title);
      const cleaned   = cleanTitle(this.current.title);
      const { artist, songTitle } = splitTrack(cleaned);

      this._autoStep++;
      // Force genre/artist escape every 5 songs to avoid getting stuck
      const forceEscape = this._autoStep % 5 === 0;

      // Artist repetition guard — after 2 picks from same artist, escape
      const artistKey     = (this.current.author || artist || '').toLowerCase().trim();
      const artistPlays   = this._artistCount.get(artistKey) || 0;
      const artistEscape  = artistPlays >= 2 && !forceEscape;

      const queries = buildQueries(
        artistEscape ? '' : artist,   // drop artist to escape cluster
        songTitle,
        lang,
        forceEscape
      );

      console.log(`[Autoplay] Lang:${lang} Artist:"${artist}" Song:"${songTitle}" Escape:${forceEscape||artistEscape}`);

      let candidates = [];

      for (const q of queries) {
        if (Date.now() > searchDeadline) break;
        try {
          const res = await node.rest.resolve(`ytsearch:${q}`);
          if (res?.loadType === 'search' && res.data?.length) {
            candidates = res.data;
            console.log(`[Autoplay] Query "${q}" → ${candidates.length} results`);
            break;
          }
        } catch (_) {}
      }

      if (!candidates.length) {
        console.log('[Autoplay] No candidates found');
        return null;
      }

      // ── Filter ──────────────────────────────────────────────────────────────
      const currentNorm = normalize(this.current.title);
      const currentFp   = fingerprint(this.current.title);

      const filtered = candidates.filter(t => {
        const info  = t.info;
        const title = normalize(info.title);
        const fp    = fingerprint(info.title);
        const uri   = info.uri || '';

        // Already played / queued
        if (this._seenUris.has(uri))                  return false;
        if (this._seenFps.has(fp))                    return false;

        // Same song (URI or fingerprint match)
        if (uri === this.current.uri)                  return false;
        if (fp  === currentFp)                         return false;

        // Same song family (one fingerprint contains the other)
        if (fp.length > 4 && currentFp.length > 4) {
          if (fp.includes(currentFp) || currentFp.includes(fp)) return false;
        }

        // High title word-overlap → same song different version
        if (similarity(title, currentNorm) > 0.6)     return false;

        // Hard blocklist (playlists, compilations, junk)
        if (isBlocked(title))                          return false;

        // No live streams
        if (info.isStream || info.isLive)              return false;

        // Duration: must be 1:00–8:00
        const dur = info.length || 0;
        if (dur < 60_000 || dur > 8 * 60_000)         return false;

        // Language consistency (skip for forced escape)
        if (!forceEscape) {
          const candLang = detectLanguage(info.title + ' ' + (info.author || ''));
          if (candLang !== lang && lang !== 'en')      return false;
        }

        return true;
      });

      if (!filtered.length) {
        console.log('[Autoplay] All candidates filtered out');
        return null;
      }

      // ── Score ────────────────────────────────────────────────────────────────
      const scored = filtered.map(t => {
        const info       = t.info;
        const titleNorm  = normalize(info.title);
        const author     = (info.author || '').toLowerCase().trim();
        const authorPlays = this._artistCount.get(author) || 0;

        let score = 100;

        // Same artist as current — mild boost (variety, not obsession)
        if (artist && author.includes(artist.toLowerCase())) score += 15;

        // Penalise artist repetition heavily
        score -= authorPlays * 30;

        // Penalise title similarity (avoid same-song variants that slipped through)
        const sim = similarity(titleNorm, currentNorm);
        score -= sim * 150;

        // Slight boost for shorter, punchier titles (real song vs compilation)
        if (info.title.length < 60) score += 5;

        return { t, score };
      }).sort((a, b) => b.score - a.score);

      const pick = scored[0]?.t;
      if (!pick) return null;

      // ── Update memory ────────────────────────────────────────────────────────
      const pickedAuthor = (pick.info.author || '').toLowerCase().trim();
      this._seenUris.add(pick.info.uri);
      this._seenFps.add(fingerprint(pick.info.title));
      this._artistCount.set(pickedAuthor, (this._artistCount.get(pickedAuthor) || 0) + 1);

      console.log(`[Autoplay] ✅ Picked: "${pick.info.title}" by ${pick.info.author}`);

      return {
        encoded     : pick.encoded,
        title       : pick.info.title,
        uri         : pick.info.uri,
        duration    : fmt(pick.info.length),
        durationMs  : pick.info.length,
        thumbnail   : pick.info.artworkUrl || null,
        requester   : '🤖 Autoplay',
        _requesterId: null,
        _autoplay   : true,
      };

    } catch (err) {
      console.error('[Autoplay Error]', err.message);
      return null;
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────────
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