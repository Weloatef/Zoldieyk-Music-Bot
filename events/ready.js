// events/ready.js
// ─────────────────────────────────────────────────────────────
//  Fires once when the bot successfully connects to Discord.
// ─────────────────────────────────────────────────────────────

const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,   // only fires once per process lifetime

  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📻 Music channel ID: ${process.env.MUSIC_CHANNEL_ID}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} server(s)\n`);

    client.user.setActivity('🎵 Type a song name!', { type: ActivityType.Listening });
  },
};
