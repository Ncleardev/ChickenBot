const fs = require('fs');
const keep_alive = require('./server.js')
const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const databaseFilePath = './database.json';
let changed = true
let cache

const emojiRegex = /\p{Emoji}/u;

const token = process.env.TOKEN
const admin = process.env.ADMIN
const databaseBackupURL = process.env.BACKUP

client.on('ready', () => {
  console.log(`${client.user.tag} [Online]`);
  client.user.setActivity('[Online]');
  console.log('Loading database...');
  getDatabaseBackup();
  updateStatus();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case 'ping':
          updateStatus()
          interaction.reply('pong! ' + Math.round(client.ws.ping) + ' ms');
          break;
        case 'say':
          interaction.reply(interaction.options.getString('message').replaceAll('@', '@ '));
          break;
        case 'image':
          interaction.reply(`https://picsum.photos/${randomInt(500, 2000)}/${randomInt(500, 2000)}`);
          break;
        case 'roll':
          interaction.reply(`🎲 - ${randomInt(1, 6)}!`);
          break;
        case 'help':
          interaction.reply('**ChickenBot Help**\n> Commands List:\n```/ping - check bot\'s ping\n/info - info about bot and server\n/roll - roll a dice\n/say [message] - repeat message\n/reactions - auto react with emojis to every channel\'s message\n/image - send random image```');
          break;
        case 'info':
          const botEmbed = new EmbedBuilder()
            .setColor(0xC83200)
            .setTitle('*ChickenBot* Info')
            .setAuthor({ name: 'ChickenBot', iconURL: 'https://cdn.discordapp.com/avatars/871123003134595154/77770964569e735aa121dbc1b0689121.webp' })
            .setThumbnail('https://cdn.discordapp.com/avatars/871123003134595154/77770964569e735aa121dbc1b0689121.webp')
            .addFields(
              { name: 'Ping', value: String(Math.round(client.ws.ping) + ' ms'), inline: true },
              { name: 'Server count', value: String(client.guilds.cache.size), inline: true },
              { name: 'User count', value: String(updateStatus()), inline: true },
              { name: 'RAM Usage', value: String(formatMemoryUsage(process.memoryUsage())), inline: true },
              { name: 'Uptime', value: String(calculateUptime()), inline: true }
            )

          if(interaction.channel.type == ChannelType.DM){ interaction.reply({ embeds: [botEmbed] }); return }

          const serverEmbed = new EmbedBuilder()
            .setColor(0xC83200)
            .setTitle('*' + interaction.guild.name + '* Info')
            .setAuthor({ name: 'ChickenBot', iconURL: 'https://cdn.discordapp.com/avatars/871123003134595154/77770964569e735aa121dbc1b0689121.webp' })
            .setThumbnail(interaction.guild.iconURL())
            .addFields(
              { name: 'Members', value: String(interaction.guild.memberCount), inline: true },
              { name: 'Boost level', value: String(interaction.guild.premiumTier), inline: true },
              { name: 'Creation Date', value: String(interaction.guild.createdAt.toDateString()), inline: true },
              { name: 'Roles', value: String(interaction.guild.roles.cache.size), inline: true },
              { name: 'Channels', value: String(interaction.guild.channels.cache.size), inline: true },
              { name: 'Emojis', value: String(interaction.guild.emojis.cache.size), inline: true }
            )

          switch (interaction.options.getString('about')) {
            case 'bot':
              interaction.reply({ embeds: [botEmbed] }); break
            case 'server':
              interaction.reply({ embeds: [serverEmbed] }); break
            default:
              interaction.reply({ embeds: [botEmbed, serverEmbed] }); break
          }
          break;
        case 'reactions':
          let database = readDatabase();

          let channelId = interaction.channel.id;
          if (interaction.options.getChannel('channel') && interaction.options.getChannel('channel').type == ChannelType.GuildText) { channelId = interaction.options.getChannel('channel').id }

          let msg
          if (interaction.options.getString('custom')) {
            let emojis = ''
            Array.from(interaction.options.getString('custom')).forEach(emoji => {
              try { if (emojiRegex.test(emoji)) { emojis += emoji } } catch { }
            });
            if (database[channelId]) {
              database[channelId] = emojis;
              msg = 'edited'
            } else {
              database[channelId] = emojis;
              msg = 'ON'
            }
          }
          else {
            if (database[channelId]) {
              delete database[channelId];
              msg = 'OFF'
            } else {
              database[channelId] = '👍❤️😂😯😢😡';
              msg = 'ON'
            }
          }

          writeDatabase(database);
          interaction.reply(`Auto reactions **${msg}** for channel <#${channelId}>`);
          break
      }
    }
  } catch (error) {
    console.error(error)
  }
})

client.on('messageCreate', async (message) => {
  const database = readDatabase();

  if (database[message.channel.id]) {
    Array.from(database[message.channel.id]).forEach(emoji => {
      try { if (emojiRegex.test(emoji)) { message.react(emoji) } } catch { }
    });
  }
});

client.login(token);

function updateStatus() {
  let i = 0
  client.guilds.cache.forEach(element => { i += element.memberCount });
  client.user.setActivity(`/help | ${Math.round(client.ws.ping)} ms | Servers: ${client.guilds.cache.size} | Users: ${i}`);
  return i
}

function readDatabase() {
  try {
    if (changed) { cache = JSON.parse(fs.readFileSync(databaseFilePath)); changed = false }
    return cache;
  } catch (error) {
    console.error('Error reading database:', error);
    return {};
  }
}
function writeDatabase(data) {
  try {
    changed = true
    const str = JSON.stringify(data, null, 2)
    fs.writeFileSync(databaseFilePath, str);
    sendDirectMessage(admin, str)
  } catch (error) {
    console.error('Error writing database:', error);
  }
}
async function getDatabaseBackup() {
  try {
    if (!fs.existsSync(databaseFilePath)) {
      console.log('Loading backup...')
      sendDirectMessage(admin, 'Loading backup from ' + databaseBackupURL)
      const response = await fetch(databaseBackupURL);
      if (response.ok) {
        const content = await response.text();
        console.log('Backup restored!')
        fs.writeFileSync(databaseFilePath, content, 'utf8');
        console.log('Database ready!')
      } else {
        throw new Error(`Failed to get backup: ${response.statusText}`);
      }
    } else { console.log('Database ready!') }
  } catch (error) { console.error('Error:', error); }
}

async function sendDirectMessage(userId, messageContent) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(messageContent);
  } catch (error) {
    console.error(`Error sending message to user ${userId}:`, error);
  }
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1) + min) }
function formatMemoryUsage(memoryUsage) { return Math.round(memoryUsage.heapUsed / 1024 / 1024 * 10) / 10 + " MB"; }
function calculateUptime() {
  const startTime = client.readyAt;
  const currentTime = new Date();

  const uptimeInSeconds = Math.floor((currentTime - startTime) / 1000);
  const days = Math.floor(uptimeInSeconds / (3600 * 24));
  const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
  const seconds = uptimeInSeconds % 60;

  let uptimeString = '';
  if (days > 0) uptimeString += `${days}d `;
  if (hours > 0) uptimeString += `${hours}h `;
  if (minutes > 0) uptimeString += `${minutes}m `;
  uptimeString += `${seconds}s`;

  return uptimeString;
}
