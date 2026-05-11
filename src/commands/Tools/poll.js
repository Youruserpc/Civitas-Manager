import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

function formatTime(ms) {
    if (ms <= 0) return '0s';
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
}

function durationToMs(key) {
    switch (key) {
        case '1m': return 1 * 60 * 1000;
        case '5m': return 5 * 60 * 1000;
        case '1h': return 1 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        case '1w': return 7 * 24 * 60 * 60 * 1000;
        case '1mo': return 30 * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a clean Flow‑Core style poll')
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
                .setDescription('Third option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option4')
                .setDescription('Fourth option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('How long should the poll last?')
                .setRequired(true)
                .addChoices(
                    { name: '1 minute', value: '1m' },
                    { name: '5 minutes', value: '5m' },
                    { name: '1 hour', value: '1h' },
                    { name: '1 day', value: '1d' },
                    { name: '1 week', value: '1w' },
                    { name: '1 month', value: '1mo' }
                )
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const durationKey = interaction.options.getString('duration');
        const duration = durationToMs(durationKey);
        const endTime = Date.now() + duration;

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

        const votes = {};
        options.forEach(o => (votes[o] = 0));

        const row = new ActionRowBuilder();
        options.forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const buildEmbed = (final = false) => {
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const remaining = Math.max(0, endTime - Date.now());
            const timeLeft = formatTime(remaining);

            const desc = options.map(opt => {
                const count = votes[opt];
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);
                const filled = Math.round(percent / 5);
                const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(final ? `📊 Poll Ended — ${question}` : question)
                .setDescription(desc)
                .setColor(final ? 0x5865F2 : 0x2b2d31);

            embed.setFooter({
                text: final ? `${totalVotes} total votes` : `Time left: ${timeLeft}`
            });

            return embed;
        };

        const pollMessage = await interaction.reply({
            embeds: [buildEmbed(false)],
            components: [row],
            fetchReply: true
        });

        const collector = pollMessage.createMessageComponentCollector({ time: duration });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index];
            if (!selected) {
                return i.reply({ content: 'Invalid option.', ephemeral: true });
            }

            votes[selected]++;

            await i.update({
                embeds: [buildEmbed(false)],
                components: [row]
            });
        });

        const interval = setInterval(async () => {
            if (Date.now() >= endTime) {
                clearInterval(interval);
                return;
            }
            try {
                await pollMessage.edit({
                    embeds: [buildEmbed(false)],
                    components: [row]
                });
            } catch {
                clearInterval(interval);
            }
        }, 5000);

        collector.on('end', async () => {
            clearInterval(interval);
            try {
                await pollMessage.edit({
                    embeds: [buildEmbed(true)],
                    components: []
                });
            } catch {
                // ignore
            }
        });
    }
};
