const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skipto')
    .setDescription('Skip directly to a song position in the queue')
    .addIntegerOption(opt =>
      opt.setName('position').setDescription('Position number in queue').setMinValue(1).setRequired(true)
    ),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const pos = interaction.options.getInteger('position');
    if (pos > queue.tracks.length)
      return interaction.reply({ content: `❌ Queue only has **${queue.tracks.length}** song(s).`, flags: 64 });
    const target = queue.tracks[pos - 1]?.title || `#${pos}`;
    await queue.skipTo(pos);
    return interaction.reply(`⏭ Skipping to **${target}**.`);
  },
};