import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a clean style poll')
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

        if (!durationSeconds || durationSeconds <= 0) {
            return interaction.reply({
                content: '❌ Duration must be a positive number of seconds.',
                ephemeral: true
            });
        }

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
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);
            const secondsLeft = Math.ceil(remaining / 1000);

            const desc = options
                .map(opt => {
                    const count = votes[opt];
                    const percent =
                        totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);
                    const filled = Math.round(percent / 5);
                    const bar =
                        '█'.repeat(filled) + '░'.repeat(20 - filled);
                    return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
                })
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(final ? `📊 Poll Ended — ${question}` : question)
                .setDescription(desc)
                .setColor(final ? 0x5865f2 : 0x2b2d31);

            if (final) {
                embed.setFooter({ text: `${totalVotes} total votes` });
            } else {
                embed.setFooter({ text: `Time left: ${secondsLeft}s` });
            }

            return embed;
        };

        const pollMessage = await interaction.channel.send({
            embeds: [buildEmbed(false)],
            components: [row]
        });

        await interaction.reply({
            content: '✅ Poll created successfully!',
            ephemeral: true
        });

        const collector = pollMessage.createMessageComponentCollector({
            time: duration
        });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index];

            if (!selected) {
                return i.reply({
                    content: 'Invalid option.',
                    ephemeral: true
                });
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
