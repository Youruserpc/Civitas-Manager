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

        // Collect options
        const options = [];
        for (let i = 1; i <= 4; i++) {
            const opt = interaction.options.getString(`option${i}`);
            if (opt) options.push(opt);
        }

        // Vote tracking
        const votes = {};
        const voters = new Set(); // prevents double voting

        options.forEach(o => votes[o] = 0);

        // Buttons
        const row = new ActionRowBuilder();
        options.forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        // Embed builder
        const buildEmbed = (final = false) => {
            const total = Object.values(votes).reduce((a, b) => a + b, 0);

            const desc = options.map(opt => {
                const count = votes[opt];
                const percent = total === 0 ? 0 : ((count / total) * 100).toFixed(2);
                const filled = Math.round(percent / 5);
                const bar = "█".repeat(filled) + "░".repeat(20 - filled);
                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join("\n\n");

            return new EmbedBuilder()
                .setTitle(final ? `📊 Poll Ended — ${question}` : question)
                .setDescription(desc)
                .setColor(final ? 0x5865F2 : 0x2b2d31)
                .setFooter({ text: final ? `${total} total votes` : `Poll is active` });
        };

        // Send poll
        const pollMessage = await interaction.reply({
            embeds: [buildEmbed(false)],
            components: [row],
            fetchReply: true
        });

        // Collector (default 10 minutes)
        const collector = pollMessage.createMessageComponentCollector({
            time: 10 * 60 * 1000
        });

        collector.on("collect", async i => {
            // Prevent double voting
            if (voters.has(i.user.id)) {
                return i.reply({
                    content: "You have already voted.",
                    ephemeral: true
                });
            }

            voters.add(i.user.id);

            const index = i.customId.split("_")[1];
            const selected = options[index];
            votes[selected]++;

            await i.update({
                embeds: [buildEmbed(false)],
                components: [row]
            });
        });

        collector.on("end", async () => {
            await pollMessage.edit({
                embeds: [buildEmbed(true)],
                components: []
            });
        });
    }
};
