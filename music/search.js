// music/search.js
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execFileAsync = promisify(execFile);

const YTDLP = process.platform === 'win32'
  ? path.join(__dirname, '..', 'yt-dlp.exe')
  : path.join(__dirname, '..', 'yt-dlp');

async function searchTrack(query, requester) {
  try {
    const isUrl  = /^https?:\/\//.test(query);
    const target = isUrl ? query : `ytsearch1:${query}`;

    const { stdout } = await execFileAsync(YTDLP, [
      target,
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      '--quiet',
    ]);

    const info  = JSON.parse(stdout);
    const video = info.entries ? info.entries[0] : info;
    if (!video) return null;

    return {
      title    : video.title,
      url      : video.webpage_url || video.url,
      duration : formatDuration(video.duration),
      thumbnail: video.thumbnail || null,
      requester,
    };
  } catch (err) {
    console.error(`[Search Error] ${err.message}`);
    return null;
  }
}

function formatDuration(sec) {
  if (!sec) return 'Unknown';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

module.exports = { searchTrack };