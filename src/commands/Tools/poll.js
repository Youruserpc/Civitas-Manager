import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

function parseDuration(input) {
  if (!input) return 0;
  input = String(input).trim().toLowerCase();
  // plain seconds number
  if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;
  // formats like 30s, 5m, 1h
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
  if (ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  return `${Math.ceil(s / 3600)}h`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a Flow‑Core style poll with timer')
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
        .setDescription('Third option (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('option4')
        .setDescription('Fourth option (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration (seconds or 30s, 5m, 1h). Example: 60 or 5m')
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
        content: '❌ You need at least **2 options**.',
        ephemeral: true
      });
    }

    // vote tracking
    const voteCounts = new Map(); // option -> count
    options.forEach(o => voteCounts.set(o, 0));
    const userVotes = new Map(); // userId -> option

    // build buttons
    const buttonsRow = new ActionRowBuilder();
    options.forEach((opt, i) => {
      buttonsRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${i}`)
          .setLabel(opt.length > 80 ? opt.slice(0, 77) + '...' : opt)
          .setStyle(ButtonStyle.Primary)
      );
    });

    // end poll button (only author can use)
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_end')
        .setLabel('End Poll')
        .setStyle(ButtonStyle.Danger)
    );

    // initial embed
    const initialEmbed = new EmbedBuilder()
      .setTitle(question)
      .setColor(0x2b2d31)
      .setDescription(options.map(opt => `**${opt}**\n${'░'.repeat(20)} 0.00% (0 votes)`).join('\n\n'))
      .setFooter({ text: `Ends in ${humanTime(durationMs)}` })
      .setTimestamp();

    // send poll as the command reply and fetch the message
    const pollMessage = await interaction.reply({
      embeds: [initialEmbed],
      components: [buttonsRow, controlRow],
      fetchReply: true
    });

    // ephemeral confirmation
    await interaction.followUp({ content: '✅ Poll created successfully!', ephemeral: true });

    const endTime = Date.now() + durationMs;
    let countdownInterval = null;

    // helper to build embed from current votes
    function buildEmbed(final = false) {
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
        .setFooter({ text: final ? `${Array.from(voteCounts.values()).reduce((a,b)=>a+b,0)} total votes` : `Ends in ${humanTime(Math.max(0, endTime - Date.now()))}` })
        .setTimestamp();

      return embed;
    }

    // update countdown every 5s
    countdownInterval = setInterval(async () => {
      try {
        const remaining = Math.max(0, endTime - Date.now());
        // update only footer to reduce churn
        await pollMessage.edit({ embeds: [buildEmbed(false)], components: [buttonsRow, controlRow] });
        if (remaining <= 0) {
          clearInterval(countdownInterval);
        }
      } catch (err) {
        // ignore update errors (e.g., message deleted or interaction expired)
        clearInterval(countdownInterval);
      }
    }, 5000);

    // collector for votes and control
    const collector = pollMessage.createMessageComponentCollector({ time: durationMs });

    collector.on('collect', async i => {
      try {
        // End button
        if (i.customId === 'poll_end') {
          // only author can end
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'Only the poll creator can end this poll early.', ephemeral: true });
          }
          collector.stop('ended_by_author');
          return i.update({ content: 'Poll ended by creator', embeds: [buildEmbed(true)], components: [] });
        }

        // Vote button
        if (i.customId.startsWith('poll_vote_')) {
          const idx = parseInt(i.customId.split('_')[2], 10);
          if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
            return i.reply({ content: 'Invalid option', ephemeral: true });
          }
          const chosen = options[idx];
          const prev = userVotes.get(i.user.id);

          // if user voted same option, ignore (or you could unvote)
          if (prev === chosen) {
            // optional: unvote on second click
            // userVotes.delete(i.user.id);
            // voteCounts.set(chosen, Math.max(0, voteCounts.get(chosen) - 1));
            // await i.update({ embeds: [buildEmbed(false)], components: [buttonsRow, controlRow] });
            return i.reply({ content: 'You already voted for that option.', ephemeral: true });
          }

          // switch vote if needed
          if (prev) {
            voteCounts.set(prev, Math.max(0, voteCounts.get(prev) - 1));
          }
          userVotes.set(i.user.id, chosen);
          voteCounts.set(chosen, (voteCounts.get(chosen) || 0) + 1);

          // update embed live
          await i.update({ embeds: [buildEmbed(false)], components: [buttonsRow, controlRow] });
        }
      } catch (err) {
        // If interaction expired or other error, try to log and ignore
        try { await i.reply({ content: 'An error occurred while processing your vote.', ephemeral: true }); } catch {}
      }
    });

    collector.on('end', async (collected, reason) => {
      clearInterval(countdownInterval);
      // final embed and disable buttons
      try {
        const finalEmbed = buildEmbed(true);
        // disable buttons visually
        const disabledRows = [];
        const disabledButtons = buttonsRow.components.map(b => b.setDisabled(true));
        const disabledControl = controlRow.components.map(b => b.setDisabled(true));
        const disabledButtonsRow = new ActionRowBuilder().addComponents(...disabledButtons);
        const disabledControlRow = new ActionRowBuilder().addComponents(...disabledControl);
        disabledRows.push(disabledButtonsRow);
        disabledRows.push(disabledControlRow);

        await pollMessage.edit({ embeds: [finalEmbed], components: [] });
        // post a summary message (optional)
        await interaction.followUp({ content: `📊 Poll ended — results posted above.`, ephemeral: false });
      } catch (err) {
        // ignore
      }
    });
  }
};
