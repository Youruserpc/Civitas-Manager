import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

const MAX_OPTIONS = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a clean poll with buttons')
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
            opt.setName('option5')
                .setDescription('Fifth option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option6')
                .setDescription('Sixth option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option7')
                .setDescription('Seventh option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option8')
                .setDescription('Eighth option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option9')
                .setDescription('Ninth option')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('option10')
                .setDescription('Tenth option')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // DO NOT DEFER — this avoids rate limits
            const question = interaction.options.getString('question');

            const options = [];
            for (let i = 1; i <= MAX_OPTIONS; i++) {
                const opt = interaction.options.getString(`option${i}`);
                if (opt) options.push(opt);
            }

            if (options.length < 2) {
                return interaction.reply({
                    embeds: [errorEmbed('You need at least **2 options**.')],
                    ephemeral: true
                });
            }

            const votes = {};
            options.forEach(o => votes[o] = 0);

            const row = new ActionRowBuilder();
            options.forEach((opt, i) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_${i}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const embed = successEmbed(
                '📊 Poll Started',
                options.map(o => `**${o}** — 0% (0 votes)`).join('\n')
            ).setTitle(question);

            const pollMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            // Send a simple ephemeral confirmation
            await interaction.reply({
                content: '✅ Poll created successfully!',
                ephemeral: true
            });

            const collector = pollMessage.createMessageComponentCollector({ time: 86400000 });

            collector.on('collect', async i => {
                const index = i.customId.split('_')[1];
                const selected = options[index];

                votes[selected]++;
collector.on('collect', async i => {
    const index = i.customId.split('_')[1];
    const selected = options[index];

    votes[selected]++;

    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

    const pollText = options.map(opt => {
        const count = votes[opt];
        const percent = totalVotes === 0 ? 0 : ((count / totalVotes) * 100).toFixed(1);

        const blocks = Math.round(percent / 10);
        const bar = '█'.repeat(blocks) + '░'.repeat(10 - blocks);

        return `**${opt}**\n${bar} ${percent}% (${count} votes)`;
    }).join('\n\n');

    const updatedEmbed = {
        title: question,
        description: pollText,
        color: 0x5865F2
    };

    await i.update({ embeds: [updatedEmbed], components: [row] });
});

                const total = Object.values(votes).reduce((a, b) => a + b, 0);

                const updatedEmbed = successEmbed(
                    '📊 Poll',
                    options.map(opt => {
                        const count = votes[opt];
                        const percent = total === 0 ? 0 : ((count / total) * 100).toFixed(2);
                        return `**${opt}** — ${percent}% (${count} votes)`;
                    }).join('\n')
                ).setTitle(question);

                await i.update({ embeds: [updatedEmbed], components: [row] });
            });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'poll'
            });
        }
    }
};
