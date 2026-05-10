const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Cycle loop mode: Off → Loop Song → Loop Queue → Off'),

  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    await queue.toggleLoop();
    const state = queue.loop ? '🔁 **Loop song** enabled.' : queue.loopQueue ? '🔁 **Loop queue** enabled.' : '➡️ Loop **disabled**.';
    return interaction.reply(state);
  },
};
