const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue by its position')
    .addIntegerOption(opt =>
      opt.setName('position')
        .setDescription('Position in queue (use /queue to see numbers)')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const pos = interaction.options.getInteger('position');
    if (pos > queue.tracks.length) {
      return interaction.reply({ content: `❌ Queue only has **${queue.tracks.length}** song(s).`, flags: 64 });
    }
    const removed = queue.tracks.splice(pos - 1, 1)[0];
    return interaction.reply(`🗑️ Removed **${removed.title}** from position #${pos}.`);
  },
};
