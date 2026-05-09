// commands/skip.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) {
      return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }
    const title = queue.current.title;
    queue.skip();
    return interaction.reply(`⏭️ Skipped **${title}**.`);
  },
};
