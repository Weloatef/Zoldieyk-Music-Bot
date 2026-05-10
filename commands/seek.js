const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a position in the current song')
    .addStringOption(opt =>
      opt.setName('time').setDescription('Time to seek to (e.g. 1:30 or 90)').setRequired(true)
    ),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.current) return interaction.reply({ content: '🔇 Nothing is playing.', flags: 64 });
    const str = interaction.options.getString('time');
    const ms  = parseTime(str);
    if (!ms) return interaction.reply({ content: '❌ Invalid time. Use `1:30` or `90`.', flags: 64 });
    if (queue.current.durationMs && ms > queue.current.durationMs)
      return interaction.reply({ content: `❌ Song is only ${queue.current.duration} long.`, flags: 64 });
    await queue.seek(ms);
    return interaction.reply(`⏩ Jumped to **${fmt(ms)}**.`);
  },
};
function parseTime(str) {
  if (!str) return null;
  if (/^\d+$/.test(str)) return parseInt(str) * 1000;
  const p = str.split(':').map(Number);
  if (p.length === 2) return (p[0] * 60 + p[1]) * 1000;
  if (p.length === 3) return (p[0] * 3600 + p[1] * 60 + p[2]) * 1000;
  return null;
}
function fmt(ms) {
  const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}