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

        if (options.length < 2) {
            return interaction.reply({
                content: "You need at least 2 options to create a poll.",
                ephemeral: true
            });
        }

        // Vote tracking
        const votes = {};
        const userVotes = {}; // userId → option index

        options.forEach(o => votes[o] = 0);

        // Buttons
        const row = new ActionRowBuilder();
        options.forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`vote_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        // Embed builder
        const buildEmbed = () => {
            const total = Object.values(votes).reduce((a, b) => a + b, 0);

            const desc = options.map(opt => {
                const count = votes[opt];
                const percent = total === 0 ? 0 : ((count / total) * 100).toFixed(2);
                const filled = Math.round(percent / 5);
                const bar = "█".repeat(filled) + "░".repeat(20 - filled);
                return `**${opt}**\n${bar}  ${percent}% (${count} votes)`;
            }).join("\n\n");

            return new EmbedBuilder()
                .setTitle(question)
                .setDescription(desc)
                .setColor(0x2b2d31)
                .setFooter({ text: "Poll is active" });
        };

        // Send poll
        const pollMessage = await interaction.reply({
            embeds: [buildEmbed()],
            components: [row],
            fetchReply: true
        });

        // Collector
        const collector = pollMessage.createMessageComponentCollector({
            time: 60 * 60 * 1000 // 1 hour
        });

        collector.on("collect", async i => {
            const id = i.customId;
            const userId = i.user.id;

            if (!id.startsWith("vote_")) return;

            const index = parseInt(id.split("_")[1]);
            const option = options[index];

            // If user already voted for this option → remove vote
            if (userVotes[userId] === index) {
                votes[option] = Math.max(0, votes[option] - 1);
                delete userVotes[userId];

                await i.reply({
                    content: `Your vote for **${option}** has been removed.`,
                    ephemeral: true
                });

                return pollMessage.edit({
                    embeds: [buildEmbed()],
                    components: [row]
                });
            }

            // If user voted for a different option → move vote
            if (userVotes[userId] !== undefined) {
                const oldIndex = userVotes[userId];
                const oldOption = options[oldIndex];
                votes[oldOption] = Math.max(0, votes[oldOption] - 1);
            }

            // Add new vote
            votes[option]++;
            userVotes[userId] = index;

            await i.reply({
                content: `Your vote for **${option}** has been recorded.`,
                ephemeral: true
            });

            return pollMessage.edit({
                embeds: [buildEmbed()],
                components: [row]
            });
        });

        collector.on("end", async () => {
            await pollMessage.edit({
                embeds: [buildEmbed()],
                components: []
            });
        });
    }
};
