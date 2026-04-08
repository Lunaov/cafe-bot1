require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const VERIFIED_ROLE_ID    = '1470764529372762145';
const WELCOME_CHANNEL_ID  = '1424272771722252403';
const STATUS_CHANNEL_ID   = '1490337482548711434';
const ANNOUNCE_CHANNEL_ID = '1424272771722252409';
const APPS_CHANNEL_ID     = '1470769330164732149';

// ─── STORAGE ────────────────────────────────────────────────────
const activeGiveaways    = new Map();
const xpData             = new Map();
const xpCooldowns        = new Set();
const ticketCounter      = new Map(); // userId -> number
const activeApplications = new Map(); // userId -> { type, answers, step }

function getXP(userId) { return xpData.get(userId) || { xp: 0, level: 0 }; }
function xpForLevel(level) { return 100 * (level + 1); }
function nextTicketNum(userId) {
  const n = (ticketCounter.get(userId) || 0) + 1;
  ticketCounter.set(userId, n);
  return n;
}

// ─── APPLICATION QUESTIONS ──────────────────────────────────────
const staffQuestions = [
  '☕ What is your username and age?',
  '🌸 Why do you want to be a staff member at Luna\'s Cafe?',
  '⏰ How many hours a day can you be active?',
  '🛡️ Do you have any previous moderation experience? If so, describe it.',
  '🍰 What would you do if two members were arguing in chat?',
  '✨ Is there anything else you\'d like us to know about you?'
];

const gfxQuestions = [
  '☕ What is your username and age?',
  '🎨 What type of GFX do you make? (pfp, banners, logos, etc.)',
  '🖼️ Please share your portfolio or examples of your work (links or images).',
  '⏰ How long does it usually take you to complete a commission?',
  '🌸 Why do you want to join Luna\'s Cafe as a GFX artist?',
  '✨ What software/tools do you use for your art?'
];

// ────────────────────────────────────────────────────────────────
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

// ─── MESSAGE HANDLER ────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ── DM handler for applications ──────────────────────────────────
  if (message.channel.type === ChannelType.DM) {
    const app = activeApplications.get(message.author.id);
    if (!app) return;

    app.answers.push(message.content);
    const questions = app.type === 'staff' ? staffQuestions : gfxQuestions;

    if (app.step < questions.length - 1) {
      app.step++;
      activeApplications.set(message.author.id, app);
      await message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`**Question ${app.step + 1}/${questions.length}**\n\n${questions[app.step]}`)
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕ • type your answer below" })] });
    } else {
      // Done — post to apps channel
      activeApplications.delete(message.author.id);
      const guild = client.guilds.cache.first();
      const appsChannel = guild?.channels.cache.get(APPS_CHANNEL_ID);

      const resultEmbed = new EmbedBuilder()
        .setTitle(`${app.type === 'staff' ? '🛡️ Staff' : '🎨 GFX Artist'} Application`)
        .setDescription(`Application from **${message.author.tag}** (<@${message.author.id}>)`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setColor(app.type === 'staff' ? 0xC8A97E : 0xF2C4CE)
        .setTimestamp();

      questions.forEach((q, i) => {
        resultEmbed.addFields({ name: q, value: app.answers[i] || '*No answer*', inline: false });
      });

      if (appsChannel) await appsChannel.send({ embeds: [resultEmbed] });

      await message.channel.send({ embeds: [new EmbedBuilder()
        .setTitle('✅ Application Submitted!')
        .setDescription(
          `thank you for applying to **Luna's Cafe**! ☕🌸\n\n` +
          `your application has been sent to our staff team.\n` +
          `we'll get back to you as soon as possible! ʚɞ`
        )
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕" })] });
    }
    return;
  }

  // ── Guild messages only below ─────────────────────────────────────
  const args = message.content.trim().split(/ +/);
  const command = args[0].toLowerCase();

  // ── XP GAIN ──────────────────────────────────────────────────────
  if (!xpCooldowns.has(message.author.id)) {
    const userData = getXP(message.author.id);
    userData.xp += Math.floor(Math.random() * 10) + 5;
    xpCooldowns.add(message.author.id);
    setTimeout(() => xpCooldowns.delete(message.author.id), 60000);

    while (userData.xp >= xpForLevel(userData.level)) {
      userData.xp -= xpForLevel(userData.level);
      userData.level++;
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`⭐ **${message.author.username}** leveled up to **Level ${userData.level}**! ☕🎉`)
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕" })] });
    }
    xpData.set(message.author.id, userData);
  }

  // ── !rules ───────────────────────────────────────────────────────
  if (command === '!rules') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const rulesEmbed = new EmbedBuilder()
      .setDescription(
        `﹒₊˚ʚ﹕🍰-ɞ-﹒-rulebook\n` +
        `☆☆☆☆☆ 𝘸𝘦𝘭𝘤𝘰𝘮𝘦 𝘵𝘰 𝘓𝘶𝘯𝘢'𝘴 𝘊𝘢𝘧𝘦  ✧\n` +
        `𝘣𝘦𝘧𝘰𝘳𝘦 𝘺𝘰𝘶 𝘤𝘩𝘢𝘵, 𝘨𝘳𝘢𝘣 𝘢 𝘤𝘰𝘧𝘧𝘦𝘦 𝘢𝘯𝘥 𝘳𝘦𝘢𝘥 𝘵𝘩𝘦 𝘳𝘶𝘭𝘦𝘴 ʚɞ ☕˖\n` +
        `──────── ᭨᧎ ────────\n\n` +
        `1 ． 🥐 ﹕ No NSFW content (nicknames, PFPs, or bios).\n` +
        `2 ． 🫖 ﹕ No spamming or mass @mentions.\n` +
        `3 ． 🌸 ﹕ No hate speech or attacks of any kind.\n` +
        `4 ． 🍯 ﹕ No advertising or self-promo without permission.\n` +
        `5 ． 🪄 ﹕ No drama. Keep it chill.\n` +
        `6 ． ⚖️ ﹕ Staff have the final say.\n\n` +
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
      new ButtonBuilder().setCustomId('verify').setLabel('☕ Enter the Cafe').setStyle(ButtonStyle.Success)
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
    const reqStatus  = args[2]?.toLowerCase();

    if (!commStatus || !reqStatus || !validStatuses.includes(commStatus) || !validStatuses.includes(reqStatus))
      return message.reply('⚠️ Usage: `!status <commissions> <requests>`\nOptions: `open`, `close`, `limited`');

    const statusEmoji = (s) => s === 'open' ? '🟢 Open' : s === 'close' ? '🔴 Closed' : '🟡 Limited';

    const statusChannel = message.guild.channels.cache.get(STATUS_CHANNEL_ID);
    if (!statusChannel) return message.reply('❌ Status channel not found.');

    await statusChannel.send({ embeds: [new EmbedBuilder()
      .setTitle('🎨 GFX Status ˚ʚ♡ɞ˚')
      .setDescription(
        `╰┈➤ *here's our current availability!* ☕✨\n\n` +
        `🖌️ **Commissions :** ${statusEmoji(commStatus)}\n` +
        `🎀 **Requests :** ${statusEmoji(reqStatus)}\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *questions? ask a mod!* 🍰`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" })] });

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

    await announceChannel.send({ embeds: [new EmbedBuilder()
      .setDescription(text)
      .setImage('https://media.discordapp.net/attachments/1439309522610028594/1470923495675396221/cafe_2.gif?ex=69d39801&is=69d24681&hm=b0c7b78d4f8ba83f13d376990ed440c6102562529fd327ba5d9c2531f8f082da&=')
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" })] });

    await message.reply({ content: '✅ Announcement posted!', flags: 64 });
  }

  // ── !apply ────────────────────────────────────────────────────────
  if (command === '!apply') {
    if (activeApplications.has(message.author.id))
      return message.reply('⚠️ You already have an application in progress! Check your DMs ☕');

    const applyEmbed = new EmbedBuilder()
      .setTitle('🌸 Apply to Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *what would you like to apply for?* ☕\n\n` +
        `🛡️ **Staff** — help moderate and manage the server\n` +
        `🎨 **GFX Artist** — join our creative team\n\n` +
        `click a button below to start! your application will be sent via DM 💌`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕ • applications are sent via DM" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('apply_staff').setLabel('🛡️ Staff').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('apply_gfx').setLabel('🎨 GFX Artist').setStyle(ButtonStyle.Secondary)
    );

    await message.reply({ embeds: [applyEmbed], components: [row] });
  }

  // ── !ordersetup ──────────────────────────────────────────────────
  if (command === '!ordersetup') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🎨 GFX Orders — Luna\'s Cafe')
        .setDescription(
          `╰┈➤ *want a graphic made just for you?* 🌸\n\n` +
          `🖌️ Click the button below to open an order ticket!\n` +
          `A private channel will be created for you.\n\n` +
          `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
          `╰┈➤ *please be patient, we'll get to you soon!* ☕`
        )
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_order').setLabel('🎨 Create Order').setStyle(ButtonStyle.Primary)
      )]
    });
    await message.delete();
  }

  // ── !closeticket ─────────────────────────────────────────────────
  if (command === '!closeticket') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return message.reply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });

    if (!message.channel.name.startsWith('order-'))
      return message.reply('❌ This is not a ticket channel.');

    await message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription('🔒 Closing ticket in 3 seconds... goodbye! ☕')
      .setColor(0xF2C4CE)] });

    setTimeout(async () => {
      try { await message.channel.delete(); }
      catch (e) { console.error('Could not delete ticket:', e); }
    }, 3000);
  }

  // ── !rank ─────────────────────────────────────────────────────────
  if (command === '!rank') {
    const target = message.mentions.users.first() || message.author;
    const userData = getXP(target.id);
    const needed = xpForLevel(userData.level);
    const filled = Math.floor((userData.xp / needed) * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle(`⭐ ${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `🎖️ **Level:** ${userData.level}\n` +
        `✨ **XP:** ${userData.xp} / ${needed}\n` +
        `\`${bar}\``
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" })] });
  }

  // ── !leaderboard ─────────────────────────────────────────────────
  if (command === '!leaderboard' || command === '!lb') {
    const sorted = [...xpData.entries()]
      .sort((a, b) => (b[1].level * 10000 + b[1].xp) - (a[1].level * 10000 + a[1].xp))
      .slice(0, 10);

    if (sorted.length === 0) return message.reply('No XP data yet! Start chatting ☕');

    const medals = ['🥇', '🥈', '🥉'];
    const desc = sorted.map(([id, data], i) =>
      `${medals[i] || `**${i + 1}.**`} <@${id}> — Level **${data.level}** · ${data.xp} XP`
    ).join('\n');

    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('☕ Luna\'s Cafe — Leaderboard')
      .setDescription(desc)
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕" })] });
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

  // ── Fun commands ─────────────────────────────────────────────────
  if (command === '!hug') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!hug @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(`🤗 **${message.author.username}** gives **${target.user.username}** a warm hug! ☕🍰`)
      .setColor(0xF2C4CE)] });
  }

  if (command === '!pat') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!pat @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(`🫶 **${message.author.username}** pats **${target.user.username}** on the head! ˚ʚ♡ɞ˚`)
      .setColor(0xF2C4CE)] });
  }

  if (command === '!cuddle') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!cuddle @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(`🌸 **${message.author.username}** cuddles up with **${target.user.username}**! so cozy ☕🍵`)
      .setColor(0xF2C4CE)] });
  }

  if (command === '!slap') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!slap @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(`🍳 **${message.author.username}** slapped **${target.user.username}** with a frying pan!! 💥`)
      .setColor(0xFF6B6B)] });
  }

  // ── !giveaway ─────────────────────────────────────────────────────
  if (command === '!giveaway') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });

    const minutes = parseInt(args[1]);
    const prize = args.slice(2).join(' ');
    if (isNaN(minutes) || !prize)
      return message.reply('⚠️ Usage: `!giveaway <minutes> <prize>`');

    const endTime = Date.now() + minutes * 60 * 1000;
    const endTimestamp = Math.floor(endTime / 1000);

    const giveawayMsg = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(
          `🎁 **Prize:** ${prize}\n\n` +
          `⏰ **Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n` +
          `👥 **Participants:** 0\n\n` +
          `╰┈➤ click the button below to enter! 🍀`
        )
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕ • Good luck!" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🍀 Enter Giveaway').setStyle(ButtonStyle.Success)
      )]
    });
    await message.delete();

    activeGiveaways.set(giveawayMsg.id, { prize, endTime, participants: new Set() });

    setTimeout(async () => {
      const giveaway = activeGiveaways.get(giveawayMsg.id);
      if (!giveaway) return;
      const participants = [...giveaway.participants];
      const disabledBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Ended').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      if (participants.length === 0) {
        await giveawayMsg.edit({ embeds: [new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY ENDED 🎉')
          .setDescription(`🎁 **Prize:** ${prize}\n\n😔 No one entered!`)
          .setColor(0xAAAAAA)
          .setFooter({ text: "Luna's Cafe ☕" })], components: [disabledBtn] });
      } else {
        const winner = participants[Math.floor(Math.random() * participants.length)];
        await giveawayMsg.edit({ embeds: [new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY ENDED 🎉')
          .setDescription(`🎁 **Prize:** ${prize}\n\n🏆 **Winner:** <@${winner}>\n👥 **Participants:** ${participants.length}`)
          .setColor(0xF2C4CE)
          .setFooter({ text: "Luna's Cafe ☕" })], components: [disabledBtn] });
        message.channel.send(`🎉 Congrats <@${winner}>! You won **${prize}**! ☕🎁`);
      }
      activeGiveaways.delete(giveawayMsg.id);
    }, minutes * 60 * 1000);
  }

  // ── !help ────────────────────────────────────────────────────────
  if (command === '!help') {
    message.reply({ embeds: [new EmbedBuilder()
      .setTitle('☕ Luna\'s Cafe — Commands')
      .setDescription(
        `**Setup**\n` +
        `\`!rules\` — Post the rules\n` +
        `\`!setup\` — Post verification panel\n` +
        `\`!announce <message>\` — Send an announcement\n` +
        `\`!ordersetup\` — Post GFX order panel\n\n` +
        `**Applications**\n` +
        `\`!apply\` — Apply for staff or GFX artist (via DM)\n\n` +
        `**GFX**\n` +
        `\`!status <commissions> <requests>\` — Update GFX status\n` +
        `Options: \`open\`, \`close\`, \`limited\`\n\n` +
        `**Leveling**\n` +
        `\`!rank [@user]\` — Check your rank\n` +
        `\`!leaderboard\` — Top 10 XP leaderboard\n\n` +
        `**Giveaway**\n` +
        `\`!giveaway <minutes> <prize>\` — Start a giveaway\n\n` +
        `**Moderation**\n` +
        `\`!kick @user reason\` · \`!ban @user reason\` · \`!unban <id>\`\n` +
        `\`!timeout @user <mins> reason\` · \`!untimeout @user\`\n` +
        `\`!warn @user reason\` · \`!purge <1-100>\`\n` +
        `\`!closeticket\` — Close an order ticket\n\n` +
        `**Fun**\n` +
        `\`!hug\` · \`!pat\` · \`!cuddle\` · \`!slap\` + @user\n`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: 'Luna\'s Cafe ☕' })] });
  }
});

// ─── BUTTON INTERACTIONS ─────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // ── Verify ───────────────────────────────────────────────────────
  if (interaction.customId === 'verify') {
    try {
      await interaction.member.roles.add(VERIFIED_ROLE_ID);
      await interaction.reply({ content: '☕ Welcome to Luna\'s Cafe! Enjoy your stay ʚɞ', ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Something went wrong. Please contact an admin.', ephemeral: true });
    }
  }

  // ── Apply buttons ────────────────────────────────────────────────
  if (interaction.customId === 'apply_staff' || interaction.customId === 'apply_gfx') {
    const type = interaction.customId === 'apply_staff' ? 'staff' : 'gfx';

    if (activeApplications.has(interaction.user.id))
      return interaction.reply({ content: '⚠️ You already have an application in progress! Check your DMs ☕', ephemeral: true });

    try {
      const questions = type === 'staff' ? staffQuestions : gfxQuestions;
      await interaction.user.send({ embeds: [new EmbedBuilder()
        .setTitle(`${type === 'staff' ? '🛡️ Staff' : '🎨 GFX Artist'} Application — Luna's Cafe`)
        .setDescription(
          `hey! ☕ thanks for applying!\n\n` +
          `i'll ask you **${questions.length} questions** — just reply to each one here in DMs.\n\n` +
          `**Question 1/${questions.length}**\n\n${questions[0]}`
        )
        .setColor(0xF2C4CE)
        .setFooter({ text: "Luna's Cafe ☕ • type your answer below" })] });

      activeApplications.set(interaction.user.id, { type, answers: [], step: 0 });
      await interaction.reply({ content: '✅ Check your DMs! Your application has started ☕', ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ I couldn\'t DM you! Please enable DMs from server members and try again.', ephemeral: true });
    }
  }

  // ── Create Order ─────────────────────────────────────────────────
  if (interaction.customId === 'create_order') {
    try {
      const num = nextTicketNum(interaction.user.id);
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'user';
      const staffRole = interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageGuild) && !r.managed);

      const ticketChannel = await interaction.guild.channels.create({
        name: `order-${safeName}-${num}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
          ...(staffRole ? [{ id: staffRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }] : [])
        ]
      });

      await ticketChannel.send({
        content: `${interaction.user}`,
        embeds: [new EmbedBuilder()
          .setTitle('🎨 GFX Order Ticket')
          .setDescription(
            `hey ${interaction.user}! ☕ welcome to your order ticket!\n\n` +
            `please fill in the following:\n\n` +
            `🖼️ **Type** — pfp, banner, logo, etc.\n` +
            `🎨 **Style** — colours, theme, vibe\n` +
            `📝 **Details** — text, references, extra info\n` +
            `⏰ **Deadline** — when do you need it?\n\n` +
            `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
            `staff will be with you shortly! 🌸\n` +
            `use \`!closeticket\` to close this ticket.`
          )
          .setColor(0xF2C4CE)
          .setFooter({ text: "Luna's Cafe ☕" })]
      });

      await interaction.reply({ content: `✅ Your order ticket has been created! ${ticketChannel}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not create ticket. Make sure I have **Manage Channels** permission!', ephemeral: true });
    }
  }

  // ── Giveaway Enter ────────────────────────────────────────────────
  if (interaction.customId === 'giveaway_enter') {
    const giveaway = activeGiveaways.get(interaction.message.id);
    if (!giveaway) return interaction.reply({ content: '❌ This giveaway has ended!', ephemeral: true });
    if (giveaway.participants.has(interaction.user.id))
      return interaction.reply({ content: '🍀 You\'re already entered! Good luck ☕', ephemeral: true });

    giveaway.participants.add(interaction.user.id);

    await interaction.message.edit({ embeds: [new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(
        `🎁 **Prize:** ${giveaway.prize}\n\n` +
        `⏰ **Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R> (<t:${Math.floor(giveaway.endTime / 1000)}:f>)\n` +
        `👥 **Participants:** ${giveaway.participants.size}\n\n` +
        `╰┈➤ click the button below to enter! 🍀`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: "Luna's Cafe ☕ • Good luck!" })] });

    await interaction.reply({ content: '🎉 You\'ve entered the giveaway! Good luck! 🍀', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
