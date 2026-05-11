// queue/MusicQueue.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const { recordPlay } = require('../music/stats');

// ─────────────────────────────────────────────────────────────────────────────
//  Formatting helpers
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
//  Language detection
// ─────────────────────────────────────────────────────────────────────────────
function detectLanguage(text) {
  if (/[\u0600-\u06FF]/.test(text))            return 'ar';
  if (/[\u0590-\u05FF]/.test(text))            return 'he';
  if (/[\u0400-\u04FF]/.test(text))            return 'ru';
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7A3]/.test(text))            return 'ko';
  if (/[ñáéíóúü¿¡]/.test(text) || /\b(que|como|para|porque|muy|canción|también)\b/i.test(text)) return 'es';
  if (/[àâçéèêëîïôûùœæ]/.test(text) || /\b(les|des|une|dans|avec|pour|vous)\b/i.test(text)) return 'fr';
  if (/[äöüß]/.test(text) || /\b(und|der|die|das|mit|von|ich)\b/i.test(text)) return 'de';
  if (/\b(che|della|degli|sono|questo|quella)\b/i.test(text)) return 'it';
  return 'en';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Title parsing — CRITICAL: do NOT strip " - " before splitTrack
//  cleanTitle only removes junk AFTER splitting
// ─────────────────────────────────────────────────────────────────────────────
function splitTrack(rawTitle) {
  // Pre-clean: remove everything after | (pipe) — usually junk like "Lyrics | English Translation"
  const beforePipe = rawTitle.split(/\s*\|\s*/)[0].trim();

  // Try "Artist - Song Title" — most common YouTube format
  const dashMatch = beforePipe.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    const artist    = dashMatch[1].trim();
    const songPart  = dashMatch[2].trim();
    return { artist: stripJunk(artist), songTitle: stripJunk(songPart) };
  }
  // Try "Song by Artist"
  const byMatch = beforePipe.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { artist: stripJunk(byMatch[2]), songTitle: stripJunk(byMatch[1]) };
  }
  // No separator — whole thing is the song (no known artist)
  return { artist: '', songTitle: stripJunk(beforePipe) };
}

// Strip junk from a single part (artist name or song title)
function stripJunk(str) {
  return str
    .split(/\s*\|\s*/)[0]               // drop everything after pipe
    .replace(/\(.*?\)|\[.*?\]/g, '')   // remove parenthetical & bracketed
    .replace(/\b(official|video|audio|lyrics?|letra|hd|4k|clip|mv|ft\..*|feat\..*)\b.*/gi, '')
    .replace(/\b(slowed|reverb|nightcore|sped up|speed up)\b.*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Normalize & fingerprint
// ─────────────────────────────────────────────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    // Keep Latin extended, Arabic, Cyrillic, CJK, Korean
    .replace(/[^\w\s\u00C0-\u024F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FP_WORDS = new Set([
  'official','video','audio','lyrics','lyric','letra','version','edit','live',
  'ft','feat','cover','explicit','hd','mv','mashup','loop','transition',
  'muffled','ending','intro','outro','extended','remaster','remastered',
  'acoustic','unplugged','instrumental','karaoke','visualizer','clip',
  'remix','slowed','reverb','nightcore','sped','speed','2020','2021',
  '2022','2023','2024','2025','2026','new','best','top','greatest',
]);

function fingerprint(title) {
  return normalize(title)
    .split(' ')
    .filter(w => w.length > 1 && !FP_WORDS.has(w))
    .join(' ');
}

// Word-overlap similarity [0..1] — ignores very short words
function similarity(a, b) {
  const wordsA = new Set((a || '').split(' ').filter(w => w.length > 2));
  const wordsB = new Set((b || '').split(' ').filter(w => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  const common = [...wordsA].filter(w => wordsB.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hard blocklist  (checked on normalized lowercase title)
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_EXACT   = ['playlist','compilation','megamix','medley','mashup'];
const BLOCK_PARTIAL = [
  'lyrics',          // standalone "lyrics" in title = lyrics video not real song
  'slowed','reverb','nightcore','sped up','speed up',
  'lyric video','lyrics video','letra','كلمات',
  'live concert','live performance','live session',
  'tribute','parody','karaoke','instrumental',
  'reaction','review','explained','analysis','commentary',
  'interview','behind the scenes','making of',
  'blind audition','the voice','got talent','american idol',
  'kids version','children','nursery rhyme',
  'english translation','easy lyrics','with audio',
  'best part','perfect ending','intro only',
  '1 hour','hours loop','hour loop',
  'شيلة','شيله','أنشودة','نشيد',         // Arabic chant formats
  'نسخة مدرسية','نسخه مدرسيه',            // Arabic "school version"
  'للأطفال','للاطفال','أطفال',            // Arabic "for children/kids"
  'اناشيد','أناشيد',                      // Arabic religious hymns
  'مدرسية','مدرسيه',                      // Arabic "school"
  'جيناك بهاية','بهاية',                 // specific junk pattern
  'street reaction','public reaction','that one song',
  'took over','whole street','vibe took',
  'tik tok','tiktok','trending tiktok',
  '16d audio','8d audio','8d musix','16d',
  'ending part','ending loop','perfect loop','loop version',
  'read description','check description',
  'concert','jeddah concert','live concert',
  'afro house','house remix','club remix','dj remix',
  'cover by','covered by','cadasings',
  'speed up version','sped version',
  'mind version','02h.mind',
  'حفل','حفله',                   // Arabic "concert/event"
  'ميكس','ميكسات',               // Arabic "mix/mixes"
  'ريمكس',                        // Arabic "remix"
  'جلسة','جلسات',                // Arabic "session"

];

function isBlocked(normTitle, rawTitle) {
  if (BLOCK_EXACT.some(w => normTitle === w))         return true;
  if (BLOCK_PARTIAL.some(w => normTitle.includes(w))) return true;
  // Block titles that end with a pipe (junk compilation titles like "Song Lyrics |")
  if (rawTitle && rawTitle.trim().endsWith('|'))       return true;
  // Block if title has multiple pipes (compilations/multi-song videos)
  if (rawTitle && (rawTitle.match(/\|/g) || []).length >= 2) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Genre detection — infer genre from title/author/query text
// ─────────────────────────────────────────────────────────────────────────────
function detectGenre(title, author, rawQuery) {
  const text = ((title || '') + ' ' + (author || '') + ' ' + (rawQuery || '')).toLowerCase();
  // Script-based detection first (most reliable)
  if (/[\u0600-\u06FF]/.test(text)) {
    if (/\brap\b|\bهيب هوب\b|\bمهرجانات\b/.test(text)) return 'arabic_mahraganat';
    return 'arabic_pop';
  }
  if (/[\uAC00-\uD7A3]/.test(text)) return 'kpop';
  if (/[\u3040-\u30FF]/.test(text)) return 'jpop';
  if (/[\u0400-\u04FF]/.test(text)) return 'russian_pop';
  // Latin-script genre detection
  if (/\brap\b|\bhip.?hop\b|\bdrill\b|\btrap\b|\bfreestyle\b/.test(text))       return 'rap';
  if (/\brnb\b|\br&b\b|\bsoul\b|\bneo.?soul\b/.test(text))                        return 'rnb';
  if (/\bmetal\b|\brock\b|\balternative\b|\blindie rock\b|\bgrunge\b/.test(text)) return 'rock';
  if (/\bindic\b|\blindie pop\b|\blindie folk\b/.test(text))                         return 'indie';
  if (/\bedm\b|\belectronic\b|\bhouse\b|\btechno\b|\bdubstep\b|\btrance\b/.test(text)) return 'electronic';
  if (/\bjazz\b|\bblues\b|\bswing\b|\bbossa nova\b/.test(text))                   return 'jazz';
  if (/\bcountry\b|\bbluegrass\b/.test(text))                                          return 'country';
  if (/\breggaeton\b|\blatino\b|\bsalsa\b|\bbachata\b|\bcumbia\b/.test(text))   return 'latin';
  if (/[àâçéèêëîïôûùœæ]/.test(text) || /\b(les|des|une|dans|avec)\b/.test(text))       return 'french_pop';
  if (/[ñáéíóúü]/.test(text) || /\b(que|como|para|porque|muy)\b/.test(text))            return 'latin';
  if (/[äöüß]/.test(text))                                                                 return 'german_pop';
  return 'pop';
}

// Genre → seed queries to discover artists from via Lavalink
const GENRE_SEEDS = {
  pop:              ['best pop songs 2023','popular pop hits 2022','top pop songs'],
  rap:              ['best rap songs 2023','top hip hop hits','popular rap'],
  rnb:              ['best rnb songs 2023','top r&b hits','popular soul rnb'],
  rock:             ['best rock songs 2023','top rock hits','popular alternative rock'],
  indie:            ['best indie songs 2023','top indie pop hits','popular indie folk'],
  electronic:       ['best electronic music 2023','top edm hits','popular house music'],
  jazz:             ['best jazz songs','top jazz hits','popular jazz standards'],
  country:          ['best country songs 2023','top country hits','popular country music'],
  latin:            ['best latin songs 2023','top reggaeton hits','popular latin pop'],
  french_pop:       ['meilleure musique française 2023','chansons françaises populaires','pop française hits'],
  german_pop:       ['beste deutsche Musik 2023','deutsche Pop Hits','populäre deutsche Lieder'],
  kpop:             ['best kpop songs 2023','top kpop hits','popular kpop groups'],
  jpop:             ['best jpop songs 2023','人気の日本語の曲','top japanese music'],
  russian_pop:      ['лучшие российские хиты 2023','топ русские песни','популярная русская музыка'],
  arabic_pop:       ['اجمل اغاني عربية 2023','اغاني عربية رومانسية','افضل اغاني عربية'],
  arabic_mahraganat:['مهرجانات 2023','اغاني مهرجانات شعبية','راب عربي'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Query builder — fully dynamic, no hardcoded artist lists
// ─────────────────────────────────────────────────────────────────────────────
function buildQueries(artist, lang, artistEscape, escape, genrePool) {
  const queries = [];

  if (escape || artistEscape) {
    // Pick a random artist from the dynamically discovered pool
    if (genrePool && genrePool.length > 0) {
      const available = genrePool.filter(a => a.toLowerCase() !== (artist || '').toLowerCase());
      if (available.length > 0) {
        const pick = available[Math.floor(Math.random() * available.length)];
        queries.push(`${pick} songs`);
        queries.push(`${pick} official songs`);
        return queries.filter(Boolean);
      }
    }
    // Pool not ready yet — search for similar artists dynamically
    if (artist) {
      queries.push(`${artist} songs`);  // fallback to same artist until pool is ready
    }
    return queries.filter(Boolean);
  }

  if (artist) {
    queries.push(`${artist} songs`);
    queries.push(`${artist} official songs`);
    queries.push(artist);
  }

  return queries.filter(Boolean);
}


// ─────────────────────────────────────────────────────────────────────────────
//  MusicQueue
// ─────────────────────────────────────────────────────────────────────────────
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
    this.autoplay    = true;
    this.volume      = 100;
    this._idleTimer  = null;
    this._destroyed  = false;
    this._npMessage  = null;
    this._progressInterval = null;

    // Autoplay memory
    this._seenUris    = new Set();
    this._seenFps     = new Set();
    this._artistCount = new Map();
    this._autoStep    = 0;
    this._anchorTrack = null;   // last user-requested track — autoplay always anchors here
    this._genrePool   = [];     // dynamically discovered artist pool (up to 30)
    this._genreKey    = null;   // genre key for the current pool
    this._poolReady   = false;  // true once pool has been built

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
    const dur      = t.durationMs || 0;

    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${t.title}](${t.uri})**\n\n${buildProgressBar(pos, dur)}`)
      .addFields(
        { name: 'Requested by', value: t.requester || 'Unknown', inline: true },
        { name: 'Queue',  value: `${this.tracks.length} song(s)`, inline: true },
        { name: 'Loop',   value: this.loop ? '🔁 Song' : this.loopQueue ? '🔁 Queue' : 'Off', inline: true },
        { name: 'Volume', value: `🔊 ${this.volume}%`, inline: true },
        { name: 'Autoplay', value: this.autoplay ? '🔄 On' : '⏹ Off', inline: true },
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
      try { await this._npMessage.edit({ embeds: [embed], components }); }
      catch (_) { this._stopProgressInterval(); }
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
        this.client.user.setActivity('🎵🕺'+this.current.title, { type: ActivityType.Listening });
      }
    } catch (_) {}
  }

  // ── Queue management ────────────────────────────────────────────────────────
  async addTrack(track) {
    if (track.uri)   this._seenUris.add(track.uri);
    if (track.title) this._seenFps.add(fingerprint(track.title));
    // Always update anchor when a real user requests a song
    if (!track._autoplay) this._anchorTrack = track;
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

    this.history.unshift({ ...this.current });
    if (this.history.length > 30) this.history.pop();

    // Register current song as seen immediately
    if (this.current.uri)   this._seenUris.add(this.current.uri);
    if (this.current.title) this._seenFps.add(fingerprint(this.current.title));
    // Keep anchor updated to the most recent user-requested song
    if (!this.current._autoplay) this._anchorTrack = this.current;

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

  // ── Genre pool builder — discovers up to 30 real artists via Lavalink ────────
  async _buildGenrePool(genre, anchorArtist, lang) {
    const seeds = GENRE_SEEDS[genre] || GENRE_SEEDS.pop;
    const pool  = new Map(); // artistName (lowercase) → display name

    const JUNK_CH = /lyrics|letra|translations?|official audio|music box|records|entertainment|topic$|channel|compilation|hits|playlist|\d{4}|zaramarazz|ncs|nhạc|rotana|arabsounds|free music|\bmusic\b$/i;

    try {
      const node = this.client.shoukaku.getIdealNode();
      if (!node) return [];

      for (const seed of seeds) {
        if (pool.size >= 30) break;
        try {
          const res = await node.rest.resolve(`ytsearch:${seed}`);
          if (res?.loadType !== 'search' || !res.data?.length) continue;

          for (const t of res.data) {
            if (pool.size >= 30) break;
            const rawAuthor = (t.info.author || '').trim();
            const lowerAuth = rawAuthor.toLowerCase();

            // Skip junk channels, skip anchor artist, skip already added
            if (!rawAuthor)                           continue;
            if (JUNK_CH.test(rawAuthor))              continue;
            if (lowerAuth === (anchorArtist || '').toLowerCase()) continue;
            if (pool.has(lowerAuth))                  continue;

            // Language consistency check — ensure artist name matches expected script
            const authorLang = detectLanguage(rawAuthor + ' ' + (t.info.title || ''));
            if (lang !== 'en' && authorLang !== lang && authorLang !== 'en') continue;

            pool.set(lowerAuth, rawAuthor);
          }
        } catch (_) { continue; }
      }
    } catch (_) {}

    return [...pool.values()]; // array of display-name strings
  }

  // ── Autoplay core ───────────────────────────────────────────────────────────
  async _findRelated() {
    if (!this.current) return null;

    const TIMEOUT_MS = 7_000;
    const deadline   = Date.now() + TIMEOUT_MS;

    try {
      const node = this.client.shoukaku.getIdealNode();
      if (!node) return null;

      // ── Always anchor to the last user-requested song, not the last autoplay ──
      const anchor = this._anchorTrack || this.current;
      let { artist, songTitle } = splitTrack(anchor.title);

      // Fallback 1: user's raw search query — highest priority after title parsing
      // e.g. user typed "Sherine Kalam Einieh" → extract "Sherine" or "Sherine Kalam"
      if (!artist && anchor._rawQuery) {
        const qParts = anchor._rawQuery.trim().split(/\s+/);
        // If 3+ words, likely "Artist Song Song" → take first word only
        // If 2 words, likely "Artist Song" → take first word
        // If 1 word, take it as-is
        artist = qParts.length >= 3 ? qParts[0] : qParts.slice(0, 2).join(' ');
      }

      // Fallback 2: YouTube channel name — ONLY if it looks like a real artist
      // Skip channels that are clearly compilation/lyrics channels
      const JUNK_CHANNEL_PATTERNS = /lyrics|letra|translations?|official audio|music box|sounds|records|entertainment|vevo$|topic$|\bmusic\b|channel|compilation|hits|playlist|\d{4}|zaramarazz|ncs|nhạc/i;
      if (!artist && anchor.author && !JUNK_CHANNEL_PATTERNS.test(anchor.author)) {
        artist = anchor.author;
      }

      // Detect language from combined signals
      const langText = anchor.title + ' ' + (anchor.author || '') + ' ' + (anchor._rawQuery || '') + ' ' + artist;
      const lang = detectLanguage(langText);

      // Detect genre for pool management
      const genre = detectGenre(anchor.title, anchor.author, anchor._rawQuery);

      // ── Build/rebuild genre pool when genre changes ────────────────────────
      if (!this._poolReady || this._genreKey !== genre) {
        this._genreKey  = genre;
        this._poolReady = false;
        this._genrePool = [];
        // Discover asynchronously so first autoplay isn't delayed
        this._buildGenrePool(genre, artist, lang).then(pool => {
          this._genrePool  = pool;
          this._poolReady  = true;
          console.log(`[Autoplay] 🎵 Genre pool ready: ${genre} | ${pool.length} artists | ${pool.slice(0,5).join(', ')}...`);
        }).catch(() => {});
      }

      this._autoStep++;
      const forceEscape  = this._autoStep % 7 === 0;
      const artistKey    = artist.toLowerCase().trim();
      const artistPlays  = artistKey ? (this._artistCount.get(artistKey) || 0) : 0;
      const artistEscape = artistPlays >= 3;

      console.log(`[Autoplay] Step:${this._autoStep} Genre:${genre} Lang:${lang} Artist:"${artist}" ArtistEsc:${artistEscape} Pool:${this._genrePool.length}`);

      const queries = buildQueries(artist, lang, artistEscape, forceEscape, this._genrePool);

      // ── Current song identity for dupe detection ─────────────────────────
      // Use anchor for self-comparison so autoplay picks never look like the anchor song
      const anchorFp    = fingerprint(anchor.title);
      const anchorNorm  = normalize(anchor.title);
      // Also keep current for deduplication
      const currentFp   = fingerprint(this.current.title);
      const currentNorm = normalize(this.current.title);

      // ── Try each query until we get a usable pick ────────────────────────
      for (const q of queries) {
        if (Date.now() > deadline) break;

        let res;
        try {
          res = await node.rest.resolve(`ytsearch:${q}`);
        } catch (_) { continue; }

        if (res?.loadType !== 'search' || !res.data?.length) continue;

        console.log(`[Autoplay] Query "${q}" → ${res.data.length} results`);

        // ── Filter candidates ──────────────────────────────────────────────
        // Two passes: strict (language check on), then relaxed (language check off)
        for (const strict of [true, false]) {
          const filtered = res.data.filter(t => {
            const info      = t.info;
            const titleNorm = normalize(info.title);
            const fp        = fingerprint(info.title);
            const uri       = info.uri || '';

            // Absolute dedupe — URI or fingerprint already seen
            if (this._seenUris.has(uri))  return false;
            if (this._seenFps.has(fp))    return false;

            // Same as currently playing or anchor song
            if (uri === this.current.uri) return false;
            if (uri === anchor.uri)       return false;
            if (fp === currentFp)         return false;
            if (fp === anchorFp)          return false;

            // Same song family (fingerprint containment) — check both
            if (fp.length > 3 && currentFp.length > 3) {
              if (fp.includes(currentFp) || currentFp.includes(fp)) return false;
            }
            if (fp.length > 3 && anchorFp.length > 3) {
              if (fp.includes(anchorFp) || anchorFp.includes(fp)) return false;
            }

            // High title similarity to anchor or current → same song different version
            if (similarity(titleNorm, anchorNorm) > 0.50)  return false;
            if (similarity(titleNorm, currentNorm) > 0.55) return false;

            // Hard blocklist
            if (isBlocked(titleNorm, info.title)) return false;

            // No streams or live
            if (info.isStream || info.isLive) return false;

            // Duration 1:00 – 8:00
            const dur = info.length || 0;
            if (dur < 90_000 || dur > 8 * 60_000) return false;   // min 1:30

            // Language check (strict pass only, skipped on relaxed pass)
            if (strict) {
              const candLang = detectLanguage(info.title + ' ' + (info.author || ''));
              if (lang !== 'en' && candLang !== lang) return false;
            }

            return true;
          });

          if (!filtered.length) {
            if (strict) continue; // try relaxed
            continue;             // try next query
          }

          // ── Score remaining candidates ─────────────────────────────────
          const scored = filtered.map(t => {
            const info      = t.info;
            const titleNorm = normalize(info.title);
            const author    = (info.author || '').toLowerCase().trim();
            const aPlays    = this._artistCount.get(author) || 0;

            let score = 100;
            // Mild boost for same artist as anchor (fresh artist, not repeated)
            const anchorArtistKey = splitTrack(anchor.title).artist.toLowerCase().trim();
            if (anchorArtistKey && author.includes(anchorArtistKey) && !artistEscape) score += 20;
            if (artistKey && author.includes(artistKey) && !artistEscape) score += 10;
            // Heavy penalty for repeated artist
            score -= aPlays * 35;
            // Penalty for title similarity to current
            score -= similarity(titleNorm, currentNorm) * 180;
            // Prefer shorter, clean titles (real songs vs reaction vids)
            if (info.title.length < 70) score += 8;
            // Small boost for official channels
            if (/official|vevo/i.test(info.author || '')) score += 10;

            return { t, score };
          }).sort((a, b) => b.score - a.score);

          const pick = scored[0]?.t;
          if (!pick) continue;

          // ── Register pick in memory ────────────────────────────────────
          const pickedFp     = fingerprint(pick.info.title);
          const pickedAuthor = (pick.info.author || '').toLowerCase().trim();
          this._seenUris.add(pick.info.uri);
          this._seenFps.add(pickedFp);
          if (pickedAuthor) {
            this._artistCount.set(pickedAuthor, (this._artistCount.get(pickedAuthor) || 0) + 1);
          }
          if (artistKey) {
            this._artistCount.set(artistKey, (this._artistCount.get(artistKey) || 0) + 1);
          }

          console.log(`[Autoplay] ✅ Picked: "${pick.info.title}" by ${pick.info.author}`);

          return {
            encoded     : pick.encoded,
            title       : pick.info.title,
            uri         : pick.info.uri,
            author      : pick.info.author || null,
            duration    : fmt(pick.info.length),
            durationMs  : pick.info.length,
            thumbnail   : pick.info.artworkUrl || null,
            requester   : '🤖 Autoplay',
            _requesterId: null,
            _autoplay   : true,
          };
        }
      }

      console.log('[Autoplay] ❌ No suitable track found across all queries');
      return null;

    } catch (err) {
      console.error('[Autoplay Error]', err.message);
      return null;
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────────
  async toggleAutoplay() { this.autoplay = !this.autoplay; await this._refreshUI(); return this.autoplay; }
  async replay()         { if (!this.current) return; this.tracks.unshift({ ...this.current }); this.player.stopTrack(); }
  skip()                 { this.player.stopTrack(); }

  async skipTo(position) {
    if (position < 1 || position > this.tracks.length) return false;
    this.tracks.splice(0, position - 1);
    this.player.stopTrack();
    return true;
  }

  async seek(ms)   { await this.player.seekTo(ms); await this._refreshUI(); }
  async pause()    { this.player.setPaused(true);  this.paused = true;  await this._refreshUI(); }
  async resume()   { this.player.setPaused(false); this.paused = false; await this._refreshUI(); }

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