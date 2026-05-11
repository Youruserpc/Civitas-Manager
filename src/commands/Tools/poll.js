import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

// Convert human duration to milliseconds
function parseDuration(input) {
    input = input.toLowerCase().trim();

    const map = {
        "minute": 60 * 1000,
        "minutes": 60 * 1000,
        "min": 60 * 1000,
        "m": 60 * 1000,

        "hour": 60 * 60 * 1000,
        "hours": 60 * 60 * 1000,
        "h": 60 * 60 * 1000,

        "day": 24 * 60 * 60 * 1000,
        "days": 24 * 60 * 60 * 1000,
        "d": 24 * 60 * 60 * 1000,

        "week": 7 * 24 * 60 * 60 * 1000,
        "weeks": 7 * 24 * 60 * 60 * 1000,
        "w": 7 * 24 * 60 * 60 * 1000,

        "month": 30 * 24 * 60 * 60 * 1000,
        "months": 30 * 24 * 60 * 60 * 1000,
        "mo": 30 * 24 * 60 * 60 * 1000
    };

    const parts = input.split(" ");
    if (parts.length !== 2) return NaN;

    const value = parseInt(parts[0]);
    const unit = parts[1];

    if (!value || !map[unit]) return NaN;

    return value * map[unit];
}

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
                         .addStringOption(opt =>
    opt.setName('duration')
        .setDescription('How long should the poll last? Example: 1 minute, 1 hour, 1 day, 1 week')
        .setRequired(true)
)

        )
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('Example: 1 minute, 5 minutes, 1 hour, 1 day, 1 week, 1 month')
                .setRequired(true)
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const durationInput = interaction.options.getString('duration');
        const duration = parseDuration(durationInput);

        if (!duration || isNaN(duration)) {
            return interaction.reply({
                content: '❌ Invalid duration. Try: `1 minute`, `5 minutes`, `1 hour`, `1 day`, `1 week`, `1 month`',
                ephemeral: true
            });
        }

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

        const pollMessage = await interaction.channel.send({
            embeds: [buildEmbed()],
            components: [row]
        });

        await interaction.reply({
            content: '✅ Poll created successfully!',
            ephemeral: true
        });

        const collector = pollMessage.createMessageComponentCollector({ time: duration });

        collector.on('collect', async i => {
            const index = i.customId.split('_')[1];
            const selected = options[index];
            votes[selected]++;
            await i.update({ embeds: [buildEmbed()], components: [row] });
        });

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

