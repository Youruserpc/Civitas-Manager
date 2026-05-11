import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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

        const collector = pollMessage.createMessageComponentCollector({
            time: 60 * 60 * 1000 // 1 hour default
        });

        collector.on("collect", async i => {
            const userId = i.user.id;
            const index = parseInt(i.customId.split("_")[1]);
            const selectedOption = options[index];

            // If user already voted → ask to remove vote
            if (userVotes[userId] !== undefined) {
                const oldIndex = userVotes[userId];
                const oldOption = options[oldIndex];

                return i.reply({
                    ephemeral: true,
                    content: `You already voted for **${oldOption}**.\nDo you want to remove your vote?`,
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`remove_yes_${oldIndex}`)
                                .setLabel("Remove Vote")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId("remove_no")
                                .setLabel("Cancel")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });
            }

            // User has not voted → ask to confirm vote
            return i.reply({
                ephemeral: true,
                content: `Are you sure you want to vote for **${selectedOption}**?`,
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_yes_${index}`)
                            .setLabel("Confirm Vote")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("confirm_no")
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
        });

        // Handle confirmation buttons
        collector.on("collect", async i => {
            const id = i.customId;

            // Confirm vote
            if (id.startsWith("confirm_yes_")) {
                const index = parseInt(id.split("_")[2]);
                const option = options[index];

                votes[option]++;
                userVotes[i.user.id] = index;

                await i.update({
                    content: `Your vote for **${option}** has been recorded.`,
                    components: []
                });

                return pollMessage.edit({
                    embeds: [buildEmbed()],
                    components: [row]
                });
            }

            if (id === "confirm_no") {
                return i.update({
                    content: "Vote cancelled.",
                    components: []
                });
            }

            // Remove vote
            if (id.startsWith("remove_yes_")) {
                const oldIndex = parseInt(id.split("_")[2]);
                const oldOption = options[oldIndex];

                votes[oldOption]--;
                delete userVotes[i.user.id];

                await i.update({
                    content: `Your vote for **${oldOption}** has been removed.`,
                    components: []
                });

                return pollMessage.edit({
                    embeds: [buildEmbed()],
                    components: [row]
                });
            }

            if (id === "remove_no") {
                return i.update({
                    content: "Vote removal cancelled.",
                    components: []
                });
            }
        });

        collector.on("end", async () => {
            await pollMessage.edit({
                embeds: [buildEmbed()],
                components: []
            });
        });
    }
};
