const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('replay')
    .setDescription('Restart the current song from the beginning'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const title = queue.current.title;
    await queue.replay();
    return interaction.reply(`⏮ Replaying **${title}**.`);
  },
};
