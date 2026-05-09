// events/clientReady.js
const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📻 Music channel ID: ${process.env.MUSIC_CHANNEL_ID}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} server(s)\n`);
    client.user.setActivity('🎵 Type a song name!', { type: ActivityType.Listening });
  },
};
