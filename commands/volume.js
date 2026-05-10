const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption(opt =>
      opt.setName('level')
        .setDescription('Volume level (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const vol = interaction.options.getInteger('level');
    await queue.setVolume(vol);
    return interaction.reply(`🔊 Volume set to **${vol}%**.`);
  },
};
