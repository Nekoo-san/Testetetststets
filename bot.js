require('dotenv').config();

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'find') {
        const gameId = options.getString('gameid');
        const username = options.getString('username');

        // Sofortige Antwort, dass die Verarbeitung begonnen hat
        await interaction.reply({ content: 'Processing your request...', ephemeral: true });

        try {
            // Anfrage an den Server senden
            console.log(`Sending request to server: ${process.env.SERVER_URL}/scrape with params:`, {
                placeid: gameId,
                username: username,
            });

            const response = await axios.get(`${process.env.SERVER_URL}/scrape`, {
                params: {
                    placeid: gameId,
                    username: username,
                },
            });

            console.log('Server response:', response.data); // Log the server response to ensure data is received
            const result = response.data;

            // Ein Discord Embed erstellen und die Informationen einfügen
            const embed = new EmbedBuilder()
                .setTitle('Search Result')
                .setDescription('Results for your search:')
                .addFields(
                    { name: 'Player', value: username, inline: true },
                    { name: 'Status', value: result.found ? 'Found' : 'Not Found', inline: true }
                )
                .setColor(result.found ? 'Green' : 'Red')
                .setTimestamp();

            if (result.joinLink) {
                embed.addFields({ name: 'Join Link', value: `[Click here to join the server](${result.joinLink})`, inline: false });
            }

            // Füge den Friendship Tree hinzu
            if (result.friendTree && Object.keys(result.friendTree).length > 0) {
                const treeText = formatTreeForEmbed(result.friendTree);
                embed.addFields({ name: 'Friendship Tree', value: `\`\`\`${treeText}\`\`\``, inline: false });
            }

            // Bearbeite die vorherige Nachricht mit dem Ergebnis
            await interaction.editReply({ content: 'Here are the results:', embeds: [embed] });
        } catch (error) {
            console.error('Error fetching data from server:', error.message);
            await interaction.editReply({ content: 'There was an error fetching the data from the server!' });
        }
    }
});

// Funktion zum Formatieren des Baumes für das Embed
function formatTreeForEmbed(tree, prefix = '') {
    let treeText = '';
    const keys = Object.keys(tree);
    keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const newPrefix = prefix + (isLast ? '└───' : '├───');
        treeText += `${newPrefix}${key} ${tree[key]}\n`;

        if (typeof tree[key] === 'object') {
            treeText += formatTreeForEmbed(tree[key], prefix + (isLast ? '    ' : '│   '));
        }
    });
    return treeText;
}

client.login(process.env.DISCORD_TOKEN);