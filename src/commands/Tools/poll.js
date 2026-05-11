import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

function parseDuration(input) {
  if (!input) return NaN;
  input = String(input).trim().toLowerCase();
  if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;
  const match = input.match(/^(\d+)(s|m|h)$/);
  if (!match) return NaN;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  return NaN;
}

function humanTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  return `${Math.ceil(s / 3600)}h`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a Flow Core style poll with timer')
    .addStringOption(opt =>
      opt.setName('question')
        .setDescription('Poll question')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('option1')
        .setDescription('First option')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('option2')
        .setDescription('Second option')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('option3')
        .setDescription('Third option optional')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('option4')
        .setDescription('Fourth option optional')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration seconds or 30s, 5m, 1h. Example 60 or 5m')
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question', true);
    const durationInput = interaction.options.getString('duration', true);
    const durationMs = parseDuration(durationInput);

    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return interaction.reply({
        content: '❌ Invalid duration. Use seconds (e.g., `60`) or `30s`, `5m`, `1h`.',
        ephemeral: true
      });
    }

    const options = [];
    for (let i = 1; i <= 4; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    if (options.length < 2) {
      return interaction.reply({
        content: '❌ You need at least 2 options.',
        ephemeral: true
      });
    }

    // Vote tracking
    const voteCounts = new Map();
    options.forEach(o => voteCounts.set(o, 0));
    const userVotes = new Map();

    // Buttons row
    const buttonsRow = new ActionRowBuilder();
    const optionEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
    options.forEach((opt, i) => {
      buttonsRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${i}`)
          .setLabel(opt.length > 80 ? opt.slice(0, 77) + '...' : opt)
          .setEmoji(optionEmojis[i] || null)
          .setStyle(ButtonStyle.Primary)
      );
    });

    // Control row with End Poll
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_end')
        .setLabel('End Poll')
        .setStyle(ButtonStyle.Danger)
    );

    // Build embed helper
    function buildEmbed(final = false, endTime = null) {
      const total = Array.from(voteCounts.values()).reduce((a, b) => a + b, 0);
      const lines = options.map(opt => {
        const count = voteCounts.get(opt) || 0;
        const percent = total === 0 ? 0 : (count / total) * 100;
        const percentText = percent.toFixed(2);
        const filled = Math.round(percent / 5); // 20 blocks
        const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
        return `**${opt}**\n${bar}  ${percentText}% (${count} vote${count === 1 ? '' : 's'})`;
      });

      const embed = new EmbedBuilder()
        .setTitle(final ? `📊 Poll Ended — ${question}` : question)
        .setColor(final ? 0x5865F2 : 0x2b2d31)
        .setDescription(lines.join('\n\n'))
        .setFooter({
          text: final ? `${total} total votes` : `Ends in ${humanTime(Math.max(0, endTime - Date.now()))}`
        })
        .setTimestamp();

      return embed;
    }

    // Send initial poll message
    const endTime = Date.now() + durationMs;
    const initialEmbed = buildEmbed(false, endTime);

    const pollMessage = await interaction.reply({
      embeds: [initialEmbed],
      components: [buttonsRow, controlRow],
      fetchReply: true
    });

    // Confirm creation privately
    await interaction.followUp({ content: '✅ Poll created successfully!', ephemeral: true });

    // Countdown updater
    let countdownInterval = setInterval(async () => {
      try {
        const remaining = Math.max(0, endTime - Date.now());
        await pollMessage.edit({ embeds: [buildEmbed(false, endTime)], components: [buttonsRow, controlRow] });
        if (remaining <= 0) clearInterval(countdownInterval);
      } catch (err) {
        clearInterval(countdownInterval);
      }
    }, 5000);

    // Collector
    const collector = pollMessage.createMessageComponentCollector({ time: durationMs });

    collector.on('collect', async i => {
      try {
        // End Poll button
        if (i.customId === 'poll_end') {
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'Only the poll creator can end this poll early.', ephemeral: true });
          }
          collector.stop('ended_by_author');
          return i.update({ embeds: [buildEmbed(true, endTime)], components: [] });
        }

        // Vote button
        if (i.customId.startsWith('poll_vote_')) {
          const idx = parseInt(i.customId.split('_')[2], 10);
          if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
            return i.reply({ content: 'Invalid option', ephemeral: true });
          }
          const chosen = options[idx];
          const prev = userVotes.get(i.user.id);

          // If same option clicked again, unvote
          if (prev === chosen) {
            userVotes.delete(i.user.id);
            voteCounts.set(chosen, Math.max(0, voteCounts.get(chosen) - 1));
            await i.update({ embeds: [buildEmbed(false, endTime)], components: [buttonsRow, controlRow] });
            return;
          }

          // Switch vote if previously voted
          if (prev) {
            voteCounts.set(prev, Math.max(0, voteCounts.get(prev) - 1));
          }
          userVotes.set(i.user.id, chosen);
          voteCounts.set(chosen, (voteCounts.get(chosen) || 0) + 1);

          await i.update({ embeds: [buildEmbed(false, endTime)], components: [buttonsRow, controlRow] });
        }
      } catch (err) {
        try { await i.reply({ content: 'An error occurred while processing your vote.', ephemeral: true }); } catch {}
      }
    });

    collector.on('end', async () => {
      clearInterval(countdownInterval);
      try {
        const finalEmbed = buildEmbed(true, endTime);

        // Disable buttons visually by creating disabled copies
        const disabledButtonRows = [];
        const disabledButtons = buttonsRow.components.map(b => b.setDisabled(true));
        const disabledControl = controlRow.components.map(b => b.setDisabled(true));
        const disabledButtonsRow = new ActionRowBuilder().addComponents(...disabledButtons);
        const disabledControlRow = new ActionRowBuilder().addComponents(...disabledControl);
        disabledButtonRows.push(disabledButtonsRow);
        disabledButtonRows.push(disabledControlRow);

        await pollMessage.edit({ embeds: [finalEmbed], components: [] });
        await interaction.followUp({ content: `📊 Poll ended — results posted above.`, ephemeral: false });
      } catch (err) {
        // ignore edit errors
      }
    });
  }
};
