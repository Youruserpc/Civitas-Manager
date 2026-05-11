import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a clean, modern poll with buttons')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Poll question')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('options')
                .setDescription('Comma-separated options (e.g. Yes, No, Maybe)')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const question = interaction.options.getString('question');
            const options = interaction.options.getString('options')
                .split(',')
                .map(o => o.trim())
                .filter(o => o.length > 0);

            if (options.length < 2)
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('You need at least **2 options**.')]
                });

            if (options.length > 10)
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('You can only have **up to 10 options**.')]
                });

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
                `📊 Poll Started`,
                options.map(o => `**${o}** — 0% (0 votes)`).join('\n')
            ).setTitle(question);

            const pollMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            await InteractionHelper.safeEditReply(interaction, {
                content: '✅ Poll created successfully!'
            });

            const collector = pollMessage.createMessageComponentCollector({ time: 86400000 });

            collector.on('collect', async i => {
                const index = i.customId.split('_')[1];
                const selected = options[index];

                votes[selected]++;

                const total = Object.values(votes).reduce((a, b) => a + b, 0);

                const updatedEmbed = successEmbed(
                    `📊 Poll`,
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




