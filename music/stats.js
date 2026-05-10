// music/stats.js
// In-memory stats — resets on bot restart.

const songPlays  = new Map(); // `title||uri` → { title, uri, thumbnail, count }
const userQueues = new Map(); // userId → { username, count }

function recordPlay(track, userId, username) {
  const songKey = `${track.title}||${track.uri}`;
  const song    = songPlays.get(songKey) || { title: track.title, uri: track.uri, thumbnail: track.thumbnail, count: 0 };
  song.count++;
  songPlays.set(songKey, song);

  const user = userQueues.get(userId) || { username, count: 0 };
  user.username = username;
  user.count++;
  userQueues.set(userId, user);
}

function getTopSongs(limit = 10) {
  return [...songPlays.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

function getUserStats(userId) {
  return userQueues.get(userId) || null;
}

function getTopUsers(limit = 5) {
  return [...userQueues.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

module.exports = { recordPlay, getTopSongs, getUserStats, getTopUsers };