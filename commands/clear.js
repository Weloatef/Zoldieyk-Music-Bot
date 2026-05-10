const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all songs from the queue (keeps current song playing)'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const count = queue.tracks.length;
    queue.tracks = [];
    return interaction.reply(`🗑️ Cleared **${count}** song(s) from the queue.`);
  },
};
