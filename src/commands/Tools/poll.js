import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

// Format milliseconds into "Xm Ys"
function formatTime(ms) {
    if (ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
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
                .setDescription('Poll duration in seconds')
                .setRequired(true)
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const duration = interaction.options.getInteger('duration') * 1000; // ms
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

        // Build embed function (with timeleft)
        const buildEmbed = () => {
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
                title: question,
                description: pollText,
                color: 0x2b2d31,
                footer: { text: `Time left: ${timeLeft}` }
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

            // Final embed without timeleft
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

            const finalText = options.map(opt => {
                const count = votes[opt];
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);
                const filled = Math.round(percent / 5);
                const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join('\n\n');

            await pollMessage.edit({
                embeds: [{
                    title: `📊 Poll Ended — ${question}`,
                    description: finalText,
                    color: 0x5865F2,
                    footer: { text: `${totalVotes} total votes` }
                }],
                components: []
            });
        });
    }
};
