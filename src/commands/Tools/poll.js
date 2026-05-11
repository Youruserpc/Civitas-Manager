import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

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
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');

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

        // Initial embed
        const embed = {
            title: question,
            description: options.map(opt => `**${opt}**\n░░░░░░░░░░░░░░░░░░░░ 0% (0 votes)`).join('\n\n'),
            color: 0x2b2d31,
            footer: { text: 'Poll started' }
        };

        // Send poll message
        const pollMessage = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        // Ephemeral confirmation
        await interaction.reply({
            content: '✅ Poll created successfully!',
            ephemeral: true
        });

        // Collector
        const collector = pollMessage.createMessageComponentCollector({ time: 86400000 });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index];

            votes[selected]++;

            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

            const pollText = options.map(opt => {
                const count = votes[opt];
                const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(2);

                // Flow Core style bar (20 blocks)
                const filled = Math.round(percent / 5);
                const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join('\n\n');

            const updatedEmbed = {
                title: question,
                description: pollText,
                color: 0x2b2d31,
                footer: { text: `${totalVotes} total votes` }
            };

            await i.update({ embeds: [updatedEmbed], components: [row] });
        });
    }
};
