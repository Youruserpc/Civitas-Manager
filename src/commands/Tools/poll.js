import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

// Format time left
function formatTime(ms) {
    if (ms <= 0) return "0s";

    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
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
        .addIntegerOption(opt =>
            opt.setName('duration')
                .setDescription('Poll duration in seconds (e.g. 60, 300, 3600)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const durationSeconds = interaction.options.getInteger('duration');
        const duration = durationSeconds * 1000;
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

        // Votes stored in memory
        const votes = {};
        options.forEach(o => votes[o] = 0);

        // Build buttons
        const row = new ActionRowBuilder();
        options.forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        // Build embed (your original style)
        const buildEmbed = (final = false) => {
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const timeLeft = formatTime(endTime - Date.now());

            const pollText = options.map(opt => {
                const count = votes[opt];
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);

                const filled = Math.round(percent / 5);
                const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join('\n\n');

            return {
                title: final ? `📊 Poll Ended — ${question}` : question,
                description: pollText,
                color: final ? 0x5865F2 : 0x2b2d31,
                footer: {
                    text: final
                        ? `${totalVotes} total votes`
                        : `Time left: ${timeLeft}`
                }
            };
        };

        // Send poll message
        const pollMessage = await interaction.channel.send({
            embeds: [buildEmbed()],
            components: [row]
        });

        // Ephemeral confirmation
        await interaction.reply({
            content: '✅ Poll created successfully!',
            ephemeral: true
        });

        // Collector
        const collector = pollMessage.createMessageComponentCollector({ time: duration });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index];

            votes[selected]++;

            await i.update({ embeds: [buildEmbed()], components: [row] });
        });

        // Update countdown every 5 seconds
        const interval = setInterval(async () => {
            if (Date.now() >= endTime) return clearInterval(interval);
            try {
                await pollMessage.edit({ embeds: [buildEmbed()], components: [row] });
            } catch {
                clearInterval(interval);
            }
        }, 5000);

        collector.on('end', async () => {
            clearInterval(interval);

            await pollMessage.edit({
                embeds: [buildEmbed(true)],
                components: []
            });
        });
    }
};

