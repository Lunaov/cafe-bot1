require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const VERIFIED_ROLE_ID = '1470764529372762145';
const WELCOME_CHANNEL_ID = '1424272771722252403';
const STATUS_CHANNEL_ID = '1490337482548711434';
const ANNOUNCE_CHANNEL_ID = '1424272771722252409';

// ─── GIVEAWAY STORAGE ───────────────────────────────────────────
const activeGiveaways = new Map();

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ─── WELCOME NEW MEMBERS ────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('☕ a new guest has arrived!')
    .setDescription(
      `𝘸𝘦𝘭𝘤𝘰𝘮𝘦 𝘵𝘰 𝘓𝘶𝘯𝘢'𝘴 𝘊𝘢𝘧𝘦, ${member} ʚɞ\n\n` +
      `☕ grab a seat and check the rules\n` +
      `🍰 we're happy you're here!`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage('https://media.discordapp.net/attachments/1474855622880002191/1485288996874752100/image.png?ex=69d1cd6c&is=69d07bec&hm=3a8f33f73d80bfe91497ecee4551f43e6984d334c151bf726a4c2e3b1d773ad7&=&format=webp&quality=lossless&width=550&height=309')
    .setColor(0xF2C4CE)
    .setFooter({ text: `member #${member.guild.memberCount}` });

  channel.send({ embeds: [embed] });
});

// ─── COMMANDS ───────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args[0].toLowerCase();

  // ── !rules ──────────────────────────────────────────────────────
  if (command === '!rules') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const rulesEmbed = new EmbedBuilder()
      .setDescription(
        `﹒₊˚ʚ﹕🍰-ɞ-﹒-rulebook\n` +
        `☆☆☆☆☆ 𝘸𝘦𝘭𝘤𝘰𝘮𝘦 𝘵𝘰 𝘓𝘶𝘯𝘢'𝘴 𝘊𝘢𝘧𝘦  ✧\n` +
        `𝘣𝘦𝘧𝘰𝘳𝘦 𝘺𝘰𝘶 𝘤𝘩𝘢𝘵, 𝘨𝘳𝘢𝘣 𝘢 𝘤𝘰𝘧𝘧𝘦𝘦 𝘢𝘯𝘥 𝘳𝘦𝘢𝘥 𝘵𝘩𝘦 𝘳𝘶𝘭𝘦𝘴 ʚɞ ☕˖\n` +
        `──────── ᭨᧎ ────────\n\n` +
        `1 ． 🥐 ﹕ No NSFW content (nicknames, PFPs, or bios). Staff may reset names like a spilled latte!\n` +
        `2 ． 🫖 ﹕ No spamming or mass @mentions. Keep the chat as calm as a quiet café corner.\n` +
        `3 ． 🌸 ﹕ No attacks (racism, sexism, hate speech). Treat everyone like a friendly barista!\n` +
        `4 ． 🯠﹕ No advertising or self-promo without Luna's permission. Only sweet treats allowed.\n` +
        `5 ． 🪠﹕ No drama. Keep your tea hot but your chats chill.\n` +
        `6 ． ⚖️ ﹕ Staff have the final say. Arguing is like leaving your coffee out—timeout incoming!\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ 𝘢𝘯𝘺 𝘲𝘶𝘦𝘴𝘵𝘪𝘰𝘯𝘴? 𝘢𝘴𝘬 𝘮𝘦 𝘰𝘳 𝘢 𝘮𝘰𝘥 !! ☕✨`
      )
      .setImage('https://media.discordapp.net/attachments/1424272771722252406/1485289593288003754/image.png?ex=69d1cdfa&is=69d07c7a&hm=39c60c437f086d2451272681d6defb600658bf377621abbc6a1ae317ffe6f0d8&=&format=webp&quality=lossless&width=1387&height=780')
      .setColor(0xF2C4CE);

    await message.channel.send({ embeds: [rulesEmbed] });
    await message.delete();
  }

  // ── !setup ───────────────────────────────────────────────────────
  if (command === '!setup') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const verifyEmbed = new EmbedBuilder()
      .setTitle('☕ Get Access to the Cafe!')
      .setImage('https://media.discordapp.net/attachments/1474855622880002191/1485289030546493552/image.png?ex=69d1cd74&is=69d07bf4&hm=075c48165814cb666a26e35c74083ace3f9895e5334ad846bc3cfd02c4e3926f&=&format=webp&quality=lossless&width=1387&height=780')
      .setColor(0xC8A97E);

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify')
        .setLabel('☕ Enter the Cafe')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [verifyEmbed], components: [button] });
    await message.delete();
  }

  // ── !status ──────────────────────────────────────────────────────
  if (command === '!status') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const validStatuses = ['open', 'close', 'limited'];
    const commStatus = args[1]?.toLowerCase();
    const reqStatus = args[2]?.toLowerCase();

    if (!commStatus || !reqStatus || !validStatuses.includes(commStatus) || !validStatuses.includes(reqStatus))
      return message.reply('⚠️ Usage: `!status <commissions> <requests>`\nOptions: `open`, `close`, `limited`\nExample: `!status open limited`');

    const statusEmoji = (s) => s === 'open' ? '🟢 Open' : s === 'close' ? '🔴 Closed' : '🟡 Limited';

    const embed = new EmbedBuilder()
      .setTitle('🎨 GFX Status ˚ʚ♡ɞ˚')
      .setDescription(
        `╰┈➤ *here's our current availability!* ☕✨\n\n` +
        `🖌️ **Commissions :** ${statusEmoji(commStatus)}\n` +
        `🎀 **Requests :** ${statusEmoji(reqStatus)}\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *questions? ask a mod!* 🍰`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" });

    const statusChannel = message.guild.channels.cache.get(STATUS_CHANNEL_ID);
    if (!statusChannel) return message.reply('❌ Status channel not found.');

    await statusChannel.send({ embeds: [embed] });
    await message.reply({ content: '✅ Status posted!', flags: 64 });
  }

  // ── !announce ────────────────────────────────────────────────────
  if (command === '!announce') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const text = args.slice(1).join(' ');
    if (!text) return message.reply('⚠️ Usage: `!announce <message>`');

    const announceChannel = message.guild.channels.cache.get(ANNOUNCE_CHANNEL_ID);
    if (!announceChannel) return message.reply('❌ Announcement channel not found.');

    const embed = new EmbedBuilder()
      .setDescription(text)
      .setImage('https://media.discordapp.net/attachments/1439309522610028594/1470923495675396221/cafe_2.gif?ex=69d39801&is=69d24681&hm=b0c7b78d4f8ba83f13d376990ed440c6102562529fd327ba5d9c2531f8f082da&=')
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" });

    await announceChannel.send({ embeds: [embed] });
    await message.reply({ content: '✅ Announcement posted!', flags: 64 });
  }

  // ── !kick ────────────────────────────────────────────────────────
  if (command === '!kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
      return message.reply({ content: '❌ You need **Kick Members** permission.', flags: 64 });

    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!kick @user reason`');

    const reason = args.slice(2).join(' ') || 'No reason provided';
    try {
      await target.kick(reason);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`☕ **${target.user.tag}** has been kicked.\n📝 Reason: ${reason}`)
        .setColor(0xFF6B6B)] });
    } catch { message.reply('❌ Could not kick that user.'); }
  }

  // ── !ban ─────────────────────────────────────────────────────────
  if (command === '!ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.reply({ content: '❌ You need **Ban Members** permission.', flags: 64 });

    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!ban @user reason`');

    const reason = args.slice(2).join(' ') || 'No reason provided';
    try {
      await target.ban({ reason });
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`🚫 **${target.user.tag}** has been banned.\n📝 Reason: ${reason}`)
        .setColor(0xFF0000)] });
    } catch { message.reply('❌ Could not ban that user.'); }
  }

  // ── !unban ───────────────────────────────────────────────────────
  if (command === '!unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
      return message.reply({ content: '❌ You need **Ban Members** permission.', flags: 64 });

    const userId = args[1];
    if (!userId) return message.reply('⚠️ Usage: `!unban <userID>`');
    try {
      await message.guild.members.unban(userId);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`✅ User **${userId}** has been unbanned.`)
        .setColor(0x57F287)] });
    } catch { message.reply('❌ Could not unban. Check the ID.'); }
  }

  // ── !timeout ─────────────────────────────────────────────────────
  if (command === '!timeout') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.reply({ content: '❌ You need **Moderate Members** permission.', flags: 64 });

    const target = message.mentions.members.first();
    const minutes = parseInt(args[2]);
    if (!target || isNaN(minutes)) return message.reply('⚠️ Usage: `!timeout @user <minutes> reason`');

    const reason = args.slice(3).join(' ') || 'No reason provided';
    try {
      await target.timeout(minutes * 60 * 1000, reason);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`⏳ **${target.user.tag}** timed out for **${minutes} min**.\n📝 Reason: ${reason}`)
        .setColor(0xFFA500)] });
    } catch { message.reply('❌ Could not timeout that user.'); }
  }

  // ── !untimeout ───────────────────────────────────────────────────
  if (command === '!untimeout') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.reply({ content: '❌ You need **Moderate Members** permission.', flags: 64 });

    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!untimeout @user`');
    try {
      await target.timeout(null);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`✅ **${target.user.tag}**'s timeout removed.`)
        .setColor(0x57F287)] });
    } catch { message.reply('❌ Could not remove timeout.'); }
  }

  // ── !warn ────────────────────────────────────────────────────────
  if (command === '!warn') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return message.reply({ content: '❌ You need **Moderate Members** permission.', flags: 64 });

    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!warn @user reason`');

    const reason = args.slice(2).join(' ') || 'No reason provided';
    try {
      await target.send({ embeds: [new EmbedBuilder()
        .setDescription(`⚠️ You have been warned in **${message.guild.name}**.\n📝 Reason: ${reason}`)
        .setColor(0xFFD700)] });
    } catch {}

    message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(`⚠️ **${target.user.tag}** has been warned.\n📝 Reason: ${reason}`)
      .setColor(0xFFD700)] });
  }

  // ── !purge ───────────────────────────────────────────────────────
  if (command === '!purge') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.reply({ content: '❌ You need **Manage Messages** permission.', flags: 64 });

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 1 || amount > 100)
      return message.reply('⚠️ Usage: `!purge <1-100>`');

    try {
      const deleted = await message.channel.bulkDelete(amount + 1, true);
      const confirm = await message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`🧹 Deleted **${deleted.size - 1}** messages.`)
        .setColor(0xC8A97E)] });
      setTimeout(() => confirm.delete(), 3000);
    } catch { message.reply('❌ Could not delete (messages may be older than 14 days).'); }
  }

  // ── !hug ─────────────────────────────────────────────────────────
  if (command === '!hug') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!hug @user`');
    const embed = new EmbedBuilder()
      .setDescription(`🤗 **${message.author.username}** gives **${target.user.username}** a warm hug! ☕🍰`)
      .setColor(0xF2C4CE);
    message.channel.send({ embeds: [embed] });
  }

  // ── !pat ─────────────────────────────────────────────────────────
  if (command === '!pat') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!pat @user`');
    const embed = new EmbedBuilder()
      .setDescription(`🫶 **${message.author.username}** pats **${target.user.username}** on the head! ˚ʚ♡ɞ˚`)
      .setColor(0xF2C4CE);
    message.channel.send({ embeds: [embed] });
  }

  // ── !cuddle ───────────────────────────────────────────────────────
  if (command === '!cuddle') {
    const target = message.mentions.members.first();
    if (!target) return    if (!target) return message.reply('⚠️ Usage: `!cuddle @user`');
    const embed = new EmbedBuilder()
      .setDescription(`💞 **${message.author.username}** cuddles with **${target.user.username}**! ☕✨`)
      .setColor(0xF2C4CE);
    message.channel.send({ embeds: [embed] });
  }
});

// ─── BUTTON INTERACTIONS ─────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'verify') {
    const member = interaction.member;
    if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({ content: '✅ You already have access!', ephemeral: true });
    }

    try {
      await member.roles.add(VERIFIED_ROLE_ID);
      await interaction.reply({ content: '☕ Welcome to the cafe! You now have access.', ephemeral: true });
    } catch {
      interaction.reply({ content: '❌ Something went wrong while adding your role.', ephemeral: true });
    }
  }
});

// ─── GIVEAWAY HANDLING (EXAMPLE) ─────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args[0].toLowerCase();

  if (command === '!giveaway') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply('❌ You need **Manage Server** permission.');

    const duration = parseInt(args[1]);
    const prize = args.slice(2).join(' ');

    if (isNaN(duration) || !prize) return message.reply('⚠️ Usage: `!giveaway <minutes> <prize>`');

    const embed = new EmbedBuilder()
      .setTitle(`🎉 Giveaway!`)
      .setDescription(`Prize: **${prize}**\nTime: **${duration} min**`)
      .setColor(0xFFD700);

    const sentMessage = await message.channel.send({ embeds: [embed] });
    await sentMessage.react('🎉');

    activeGiveaways.set(sentMessage.id, {
      channelId: message.channel.id,
      prize,
      end: Date.now() + duration * 60000
    });

    setTimeout(async () => {
      const giveaway = activeGiveaways.get(sentMessage.id);
      if (!giveaway) return;

      const fetchedMessage = await message.channel.messages.fetch(sentMessage.id);
      const reactions = fetchedMessage.reactions.cache.get('🎉');
      const users = reactions ? await reactions.users.fetch() : new Map();
      const participants = users.filter(u => !u.bot).map(u => u.id);

      if (participants.length === 0) {
        message.channel.send(`😢 No one entered the giveaway for **${prize}**.`);
      } else {
        const winnerId = participants[Math.floor(Math.random() * participants.length)];
        message.channel.send(`🎉 Congratulations <@${winnerId}>! You won **${prize}**!`);
      }

      activeGiveaways.delete(sentMessage.id);
    }, duration * 60000);
  }
});
// ─── DATABASE SIMULATION ─────────────────────────────────────────
// Simple in-memory storage; replace with real DB later if needed
const usersDB = new Map();
const gfxOrdersDB = new Map();
const ticketsDB = new Map();

// ─── LEVELING ───────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Leveling system
  const userId = message.author.id;
  if (!usersDB.has(userId)) usersDB.set(userId, { xp: 0, level: 1 });
  const user = usersDB.get(userId);

  // Random XP per message
  const xpGain = Math.floor(Math.random() * 10) + 5;
  user.xp += xpGain;

  // Level up logic
  const xpNeeded = user.level * 100;
  if (user.xp >= xpNeeded) {
    user.level++;
    user.xp -= xpNeeded;
    message.channel.send(`🎉 Congrats <@${userId}>, you leveled up to **${user.level}**!`);
  }
  usersDB.set(userId, user);
});

// ─── PANEL COMMAND ───────────────────────────────
if (command === '!panel') {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
    return message.reply({ content: '❌ You need Manage Server permission.', flags: 64 });

  const embed = new EmbedBuilder()
    .setTitle('🎨 GFX Orders & 📝 Tickets')
    .setDescription(
      'Click a button below to **open a GFX order** or **submit a ticket**!\n\n' +
      '🎨 **GFX Order** — Request a custom GFX\n' +
      '📝 **Ticket** — Ask for help or support'
    )
    .setColor(0xF2C4CE);

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('open_gfx_order')
        .setLabel('🎨 Open GFX Order')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('📝 Open Ticket')
        .setStyle(ButtonStyle.Secondary)
    );

  message.channel.send({ embeds: [embed], components: [buttons] });
  await message.delete();
}

// ─── BUTTON INTERACTIONS ─────────────────────────
if (interaction.isButton()) {
  // --- GFX ORDER ---
  if (interaction.customId === 'open_gfx_order') {
    try {
      const channel = await interaction.guild.channels.create({
        name: `gfx-order-${interaction.user.username}`,
        type: 0, // GUILD_TEXT
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: VERIFIED_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // staff role
        ]
      });

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_order')
          .setLabel('🔒 Close Order')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `🎨 ${interaction.user}, your GFX order panel is here! Describe what you want.`, components: [closeButton] });
      await interaction.reply({ content: `✅ Your GFX order has been opened: ${channel}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not open GFX order.', ephemeral: true });
    }
  }

  // --- TICKET ---
  if (interaction.customId === 'open_ticket') {
    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0, // GUILD_TEXT
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: VERIFIED_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] } // staff role
        ]
      });

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `📝 ${interaction.user}, your support ticket is here! Please describe your issue.`, components: [closeButton] });
      await interaction.reply({ content: `✅ Your ticket has been opened: ${channel}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not open ticket.', ephemeral: true });
    }
  }

  // --- CLOSE BUTTON ---
  if (interaction.customId === 'close_ticket' || interaction.customId === 'close_order') {
    try {
      await interaction.channel.delete();
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not close this channel.', ephemeral: true });
    }
  }
}
// ─── PLAY / ECONOMY SIMULATION ─────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args[0].toLowerCase();

  if (command === '!play') {
    const games = ['🎲 Dice', '🪙 Coin Flip', '🎯 Guess the Number'];
    const game = games[Math.floor(Math.random() * games.length)];

    let resultText = '';
    if (game === '🎲 Dice') {
      const roll = Math.floor(Math.random() * 6) + 1;
      resultText = `You rolled a **${roll}** on the dice!`;
    } else if (game === '🪙 Coin Flip') {
      const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
      resultText = `You flipped the coin: **${flip}**!`;
    } else if (game === '🎯 Guess the Number') {
      const num = Math.floor(Math.random() * 10) + 1;
      resultText = `Guess a number between 1-10. The number is **${num}**!`;
    }

    message.reply(`🎮 Game: ${game}\n${resultText}`);
  }
});
// ─── LOGIN ───────────────────────────────────────────────────────
client.login(process.env.TOKEN);
