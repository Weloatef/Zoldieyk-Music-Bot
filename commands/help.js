const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available music bot commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Music Bot Commands')
      .setDescription('Type a song name in this channel to play it — no prefix needed!\nYou can also use `.commandname` or `/commandname`.')
      .addFields(
        {
          name: '▶️ Playback',
          value: '`/skip` `.skip` — Skip current song\n`/stop` `.stop` — Stop & disconnect\n`/pause` `.pause` — Pause\n`/resume` `.resume` — Resume\n`/replay` `.replay` — Restart current song',
        },
        {
          name: '📋 Queue',
          value: '`/queue` `.queue` — Show queue\n`/nowplaying` `.np` — Now playing info\n`/shuffle` `.shuffle` — Shuffle queue\n`/remove <n>` `.remove <n>` — Remove song at position\n`/clear` `.clear` — Clear the queue',
        },
        {
          name: '⚙️ Settings',
          value: '`/loop` `.loop` — Cycle: Off → Song → Queue\n`/volume <1-100>` `.volume <n>` — Set volume',
        },
        {
          name: '🎛️ UI Controls',
          value: 'Use the buttons on the Now Playing message:\n⏮ Replay · ⏸ Pause · ⏭ Skip · 🔁 Loop · 🔀 Shuffle\n🔉 Vol− · 📋 Queue · ⏹ Stop · 🔊 Vol+',
        },
      )
      .setFooter({ text: 'Just type any song name or paste a YouTube link to get started!' });

    return interaction.reply({ embeds: [embed] });
  },
};
