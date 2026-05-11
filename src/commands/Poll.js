const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Poll question')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('options')
                .setDescription('Comma separated options')
                .setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = interaction.options.getString('options').split(',');

        const votes = {};
        options.forEach(o => votes[o] = 0);

        const embed = new EmbedBuilder()
            .setTitle(question)
            .setColor('#2b2d31')
            .setTimestamp();

        const row = new ActionRowBuilder();

        options.forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${i}`)
                    .setLabel(opt.trim())
                    .setStyle(ButtonStyle.Primary)
            );
        });

        await interaction.reply({ embeds: [embed], components: [row] });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 86400000 });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index].trim();

            votes[selected]++;

            const total = Object.values(votes).reduce((a, b) => a + b, 0);

            const updatedEmbed = new EmbedBuilder()
                .setTitle(question)
                .setColor('#2b2d31')
                .setTimestamp()
                .setDescription(
                    options.map(opt => {
                        const count = votes[opt];
                        const percent = total === 0 ? 0 : ((count / total) * 100).toFixed(2);
                        return `**${opt}** — ${percent}% (${count} votes)`;
                    }).join('\n')
                );

            await i.update({ embeds: [updatedEmbed], components: [row] });
        });
    }
};
        await interaction.reply({ embeds: [embed], components: [row] });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 86400000 });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index].trim();

            votes[selected]++;

            const total = Object.values(votes).reduce((a, b) => a + b, 0);

            const updatedEmbed = new EmbedBuilder()
                .setTitle(question)
                .setColor('#2b2d31')
                .setTimestamp()
                .setDescription(
                    options.map(opt => {
                        const count = votes[opt];
                        const percent = total === 0 ? 0 : ((count / total) * 100).toFixed(2);
                        return `**${opt}** — ${percent}% (${count} votes)`;
                    }).join('\n')
                );

            await i.update({ embeds: [updatedEmbed], components: [row] });
        });
    }
};
