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

// ─── CONSTANTS ───────────────────────────────────────────────────
const VERIFIED_ROLE_ID      = '1470764529372762145';
const WELCOME_CHANNEL_ID    = '1424272771722252403';
const STATUS_CHANNEL_ID     = '1490337482548711434';
const ANNOUNCE_CHANNEL_ID   = '1424272771722252409';
const APPS_CHANNEL_ID       = '1470769330164732149';
const PARTNER_CHANNEL_ID    = '1484270944905334794';
const ANNOUNCE_IMAGE        = 'https://media.discordapp.net/attachments/1439309522610028594/1470923495675396221/cafe_2.gif?ex=69d39801&is=69d24681&hm=b0c7b78d4f8ba83f13d376990ed440c6102562529fd327ba5d9c2531f8f082da&=';

// ─── THEME ───────────────────────────────────────────────────────
const C_MAIN    = 0xADD8E6; // light blue
const C_SUCCESS = 0x90CAF9; // soft blue
const C_WARN    = 0xFFD700; // yellow
const C_ERROR   = 0xFF6B6B; // red
const C_BAN     = 0xFF0000;

// ─── STORAGE ─────────────────────────────────────────────────────
const activeGiveaways    = new Map();
const xpData             = new Map();
const xpCooldowns        = new Set();
const ticketCounter      = new Map();
const activeApplications = new Map();
let   partnerCount       = 0;

function getXP(userId) { return xpData.get(userId) || { xp: 0, level: 0 }; }
function xpForLevel(level) { return 60 * (level + 1); } // easier leveling
function nextTicketNum(userId) {
  const n = (ticketCounter.get(userId) || 0) + 1;
  ticketCounter.set(userId, n);
  return n;
}
function embed(desc, color) {
  return new EmbedBuilder().setDescription(desc).setColor(color || C_MAIN);
}

// ─── APPLICATION QUESTIONS ────────────────────────────────────────
const staffQuestions = [
  '☁️ What is your username and age?',
  '🌸 Why do you want to be staff at Luna\'s Cafe?',
  '⏰ How many hours a day can you be active?',
  '🛡️ Do you have any previous moderation experience?',
  '🍵 What would you do if two members were arguing in chat?',
  '✨ Anything else you\'d like us to know?'
];
const gfxQuestions = [
  '☁️ What is your username and age?',
  '🎨 What type of GFX do you make? (pfp, banners, logos, etc.)',
  '🖼️ Share your portfolio or examples of your work (links/images).',
  '⏰ How long does it usually take you to finish a commission?',
  '🌸 Why do you want to join Luna\'s Cafe as a GFX artist?',
  '✨ What software/tools do you use?'
];

// ─────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ─── WELCOME ──────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;
  channel.send({ embeds: [new EmbedBuilder()
    .setTitle('☁️ a new guest has arrived!')
    .setDescription(
      `𝘸𝘦𝘭𝘤𝘰𝘮𝘦 𝘵𝘰 𝘓𝘶𝘯𝘢'𝘴 𝘊𝘢𝘧𝘦, ${member} ʚɞ\n\n` +
      `☕ grab a seat and check the rules\n` +
      `🍰 we're happy you're here!`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage('https://media.discordapp.net/attachments/1474855622880002191/1485288996874752100/image.png?ex=69d1cd6c&is=69d07bec&hm=3a8f33f73d80bfe91497ecee4551f43e6984d334c151bf726a4c2e3b1d773ad7&=&format=webp&quality=lossless&width=550&height=309')
    .setColor(C_MAIN)
    .setFooter({ text: `member #${member.guild.memberCount}` })] });
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ── DM Application handler ────────────────────────────────────────
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
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️ • type your answer below" })] });
    } else {
      activeApplications.delete(message.author.id);
      const guild = client.guilds.cache.first();
      const appsChannel = guild?.channels.cache.get(APPS_CHANNEL_ID);
      const resultEmbed = new EmbedBuilder()
        .setTitle(`${app.type === 'staff' ? '🛡️ Staff' : '🎨 GFX Artist'} Application`)
        .setDescription(`Application from **${message.author.tag}** (<@${message.author.id}>)`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setColor(C_MAIN)
        .setTimestamp();
      questions.forEach((q, i) => resultEmbed.addFields({ name: q, value: app.answers[i] || '*No answer*', inline: false }));
      if (appsChannel) await appsChannel.send({ embeds: [resultEmbed] });
      await message.channel.send({ embeds: [new EmbedBuilder()
        .setTitle('✅ Application Submitted!')
        .setDescription(`thank you for applying to **Luna's Cafe**! ☁️🌸\nyour application has been sent to our staff team.\nwe'll get back to you soon! ʚɞ`)
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️" })] });
    }
    return;
  }

  // ── Partner count tracker ─────────────────────────────────────────
  if (message.channel.id === PARTNER_CHANNEL_ID) {
    partnerCount++;
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🤝 Partnership')
      .setDescription(`🌸 **Partner Count : ${partnerCount}**\n\nthank you for partnering with Luna's Cafe! ☁️✨`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
    return;
  }

  const args = message.content.trim().split(/ +/);
  const command = args[0].toLowerCase();

  // ── XP GAIN (easier: 15-25 per message) ──────────────────────────
  if (!xpCooldowns.has(message.author.id)) {
    const userData = getXP(message.author.id);
    userData.xp += Math.floor(Math.random() * 10) + 15;
    xpCooldowns.add(message.author.id);
    setTimeout(() => xpCooldowns.delete(message.author.id), 45000); // 45s cooldown

    while (userData.xp >= xpForLevel(userData.level)) {
      userData.xp -= xpForLevel(userData.level);
      userData.level++;
      message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`⭐ **${message.author.username}** leveled up to **Level ${userData.level}**! ☁️🎉`)
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️" })] });
    }
    xpData.set(message.author.id, userData);
  }

  // ── !rules ───────────────────────────────────────────────────────
  if (command === '!rules') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
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
        `╰┈➤ 𝘢𝘯𝘺 𝘲𝘶𝘦𝘴𝘵𝘪𝘰𝘯𝘴? 𝘢𝘴𝘬 𝘮𝘦 𝘰𝘳 𝘢 𝘮𝘰𝘥 !! ☁️✨`
      )
      .setImage('https://media.discordapp.net/attachments/1424272771722252406/1485289593288003754/image.png?ex=69d1cdfa&is=69d07c7a&hm=39c60c437f086d2451272681d6defb600658bf377621abbc6a1ae317ffe6f0d8&=&format=webp&quality=lossless&width=1387&height=780')
      .setColor(C_MAIN)] });
    await message.delete();
  }

  // ── !setup ───────────────────────────────────────────────────────
  if (command === '!setup') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('☁️ Get Access to the Cafe!')
        .setImage('https://media.discordapp.net/attachments/1474855622880002191/1485289030546493552/image.png?ex=69d1cd74&is=69d07bf4&hm=075c48165814cb666a26e35c74083ace3f9895e5334ad846bc3cfd02c4e3926f&=&format=webp&quality=lossless&width=1387&height=780')
        .setColor(C_MAIN)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify').setLabel('☁️ Enter the Cafe').setStyle(ButtonStyle.Primary)
      )]
    });
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
        `╰┈➤ *here's our current availability!* ☁️✨\n\n` +
        `🖌️ **Commissions :** ${statusEmoji(commStatus)}\n` +
        `🎀 **Requests :** ${statusEmoji(reqStatus)}\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *questions? ask a mod!* 🍰`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
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
      .setImage(ANNOUNCE_IMAGE)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
    await message.reply({ content: '✅ Announcement posted!', flags: 64 });
  }

  // ── !apply ────────────────────────────────────────────────────────
  if (command === '!apply') {
    if (activeApplications.has(message.author.id))
      return message.reply('⚠️ You already have an application in progress! Check your DMs ☁️');
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🌸 Apply to Luna\'s Cafe')
        .setDescription(
          `╰┈➤ *what would you like to apply for?* ☁️\n\n` +
          `🛡️ **Staff** — help moderate and manage the server\n` +
          `🎨 **GFX Artist** — join our creative team\n\n` +
          `click a button below! your application will be sent via DM 💌`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️ • applications are sent via DM" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_staff').setLabel('🛡️ Staff').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('apply_gfx').setLabel('🎨 GFX Artist').setStyle(ButtonStyle.Secondary)
      )]
    });
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
          `╰┈➤ *please be patient, we'll get to you soon!* ☁️`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️" })],
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
    await message.channel.send({ embeds: [embed('🔒 Closing ticket in 3 seconds... goodbye! ☁️', C_MAIN)] });
    setTimeout(async () => { try { await message.channel.delete(); } catch (e) { console.error(e); } }, 3000);
  }

  // ── !nuke ─────────────────────────────────────────────────────────
  if (command === '!nuke') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply({ content: '❌ You need **Administrator** permission.', flags: 64 });
    try {
      const fetched = await message.channel.messages.fetch({ limit: 100 });
      await message.channel.bulkDelete(fetched, true);
      const confirm = await message.channel.send({ embeds: [new EmbedBuilder()
        .setDescription(`💣 Channel nuked by **${message.author.username}**! All messages deleted. ☁️`)
        .setColor(C_MAIN)] });
      setTimeout(() => confirm.delete().catch(() => {}), 4000);
    } catch (e) {
      message.channel.send('❌ Could not nuke (messages may be older than 14 days).');
    }
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
      .setDescription(`🎖️ **Level:** ${userData.level}\n✨ **XP:** ${userData.xp} / ${needed}\n\`${bar}\``)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
  }

  // ── !leaderboard ─────────────────────────────────────────────────
  if (command === '!leaderboard' || command === '!lb') {
    const sorted = [...xpData.entries()]
      .sort((a, b) => (b[1].level * 10000 + b[1].xp) - (a[1].level * 10000 + a[1].xp))
      .slice(0, 10);
    if (sorted.length === 0) return message.reply('No XP data yet! Start chatting ☁️');
    const medals = ['🥇', '🥈', '🥉'];
    const desc = sorted.map(([id, data], i) =>
      `${medals[i] || `**${i + 1}.**`} <@${id}> — Level **${data.level}** · ${data.xp} XP`
    ).join('\n');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('☁️ Luna\'s Cafe — Leaderboard')
      .setDescription(desc)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
  }

  // ── !setlevel (admin) ─────────────────────────────────────────────
  if (command === '!setlevel') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const target = message.mentions.users.first();
    const level = parseInt(args[2]);
    if (!target || isNaN(level)) return message.reply('⚠️ Usage: `!setlevel @user <level>`');
    xpData.set(target.id, { xp: 0, level });
    message.channel.send({ embeds: [embed(`✅ Set **${target.username}**'s level to **${level}**. ☁️`, C_MAIN)] });
  }

  // ── !serverinfo ───────────────────────────────────────────────────
  if (command === '!serverinfo') {
    const guild = message.guild;
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle(`☁️ ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setDescription(
        `👥 **Members:** ${guild.memberCount}\n` +
        `📅 **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>\n` +
        `🤝 **Partners:** ${partnerCount}\n` +
        `👑 **Owner:** <@${guild.ownerId}>\n` +
        `💬 **Channels:** ${guild.channels.cache.size}\n` +
        `🎭 **Roles:** ${guild.roles.cache.size}`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
  }

  // ── !userinfo ────────────────────────────────────────────────────
  if (command === '!userinfo') {
    const target = message.mentions.members.first() || message.member;
    const userData = getXP(target.id);
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle(`☁️ ${target.user.username}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `🆔 **ID:** ${target.id}\n` +
        `📅 **Joined:** <t:${Math.floor(target.joinedTimestamp / 1000)}:D>\n` +
        `🎂 **Account Created:** <t:${Math.floor(target.user.createdTimestamp / 1000)}:D>\n` +
        `⭐ **Level:** ${userData.level} · ${userData.xp} XP\n` +
        `🎭 **Roles:** ${target.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'None'}`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
  }

  // ── !say ─────────────────────────────────────────────────────────
  if (command === '!say') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const text = args.slice(1).join(' ');
    if (!text) return message.reply('⚠️ Usage: `!say <message>`');
    await message.delete();
    message.channel.send(text);
  }

  // ── !ping ─────────────────────────────────────────────────────────
  if (command === '!ping') {
    message.reply({ embeds: [embed(`🏓 Pong! Latency: **${client.ws.ping}ms** ☁️`, C_MAIN)] });
  }

  // ── !8ball ────────────────────────────────────────────────────────
  if (command === '!8ball') {
    const question = args.slice(1).join(' ');
    if (!question) return message.reply('⚠️ Usage: `!8ball <question>`');
    const answers = [
      '✨ Yes, definitely!', '☁️ It is certain.', '🌸 Without a doubt!',
      '🍵 Signs point to yes.', '⭐ Very likely!', '🤍 Ask again later...',
      '☁️ Cannot predict now.', '🫧 Don\'t count on it.', '🌧️ My sources say no.',
      '❌ Very doubtful.', '🍰 Outlook not so good.', '💫 Most likely yes!'
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🎱 Magic 8-Ball')
      .setDescription(`**Question:** ${question}\n\n**Answer:** ${answer}`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
  }

  // ── !coinflip ─────────────────────────────────────────────────────
  if (command === '!coinflip') {
    const result = Math.random() < 0.5 ? '🪙 Heads!' : '🪙 Tails!';
    message.channel.send({ embeds: [embed(`**${message.author.username}** flipped a coin...\n\n**${result}**`, C_MAIN)] });
  }

  // ── !quote ────────────────────────────────────────────────────────
  if (command === '!quote') {
    const quotes = [
      'Life is like coffee — bitter at first, but worth every sip. ☕',
      'You are braver than you believe. 🌸',
      'Every day is a fresh start. ☁️',
      'Small steps still move you forward. 🍵',
      'You deserve all the good things coming your way. ✨',
      'Be the sunshine in someone\'s cloudy day. 🌤️',
      'Kindness costs nothing and means everything. 🤍',
      'Rest is not giving up — it\'s recharging. ☁️'
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('☁️ Daily Quote')
      .setDescription(`*"${q}"*`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️" })] });
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
      message.channel.send({ embeds: [embed(`☁️ **${target.user.tag}** has been kicked.\n📝 Reason: ${reason}`, C_ERROR)] });
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
      message.channel.send({ embeds: [embed(`🚫 **${target.user.tag}** has been banned.\n📝 Reason: ${reason}`, C_BAN)] });
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
      message.channel.send({ embeds: [embed(`✅ User **${userId}** has been unbanned.`, C_SUCCESS)] });
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
      message.channel.send({ embeds: [embed(`⏳ **${target.user.tag}** timed out for **${minutes} min**.\n📝 Reason: ${reason}`, C_WARN)] });
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
      message.channel.send({ embeds: [embed(`✅ **${target.user.tag}**'s timeout removed.`, C_SUCCESS)] });
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
      await target.send({ embeds: [embed(`⚠️ You have been warned in **${message.guild.name}**.\n📝 Reason: ${reason}`, C_WARN)] });
    } catch {}
    message.channel.send({ embeds: [embed(`⚠️ **${target.user.tag}** has been warned.\n📝 Reason: ${reason}`, C_WARN)] });
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
      const confirm = await message.channel.send({ embeds: [embed(`🧹 Deleted **${deleted.size - 1}** messages.`, C_MAIN)] });
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
    } catch { message.reply('❌ Could not delete (messages may be older than 14 days).'); }
  }

  // ── Fun commands ─────────────────────────────────────────────────
  if (command === '!hug') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!hug @user`');
    message.channel.send({ embeds: [embed(`🤗 **${message.author.username}** gives **${target.user.username}** a warm hug! ☁️🍰`, C_MAIN)] });
  }
  if (command === '!pat') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!pat @user`');
    message.channel.send({ embeds: [embed(`🫶 **${message.author.username}** pats **${target.user.username}** on the head! ˚ʚ♡ɞ˚`, C_MAIN)] });
  }
  if (command === '!cuddle') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!cuddle @user`');
    message.channel.send({ embeds: [embed(`🌸 **${message.author.username}** cuddles up with **${target.user.username}**! so cozy ☁️🍵`, C_MAIN)] });
  }
  if (command === '!slap') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!slap @user`');
    message.channel.send({ embeds: [embed(`🍳 **${message.author.username}** slapped **${target.user.username}** with a frying pan!! 💥`, C_ERROR)] });
  }
  if (command === '!boop') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!boop @user`');
    message.channel.send({ embeds: [embed(`👉 **${message.author.username}** booped **${target.user.username}** on the nose! 🌸`, C_MAIN)] });
  }
  if (command === '!wave') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Usage: `!wave @user`');
    message.channel.send({ embeds: [embed(`👋 **${message.author.username}** waves at **${target.user.username}**! ☁️`, C_MAIN)] });
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
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️ • Good luck!" })],
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
          .setFooter({ text: "Luna's Cafe ☁️" })], components: [disabledBtn] });
      } else {
        const winner = participants[Math.floor(Math.random() * participants.length)];
        await giveawayMsg.edit({ embeds: [new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY ENDED 🎉')
          .setDescription(`🎁 **Prize:** ${prize}\n\n🏆 **Winner:** <@${winner}>\n👥 **Participants:** ${participants.length}`)
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Cafe ☁️" })], components: [disabledBtn] });
        message.channel.send(`🎉 Congrats <@${winner}>! You won **${prize}**! ☁️🎁`);
      }
      activeGiveaways.delete(giveawayMsg.id);
    }, minutes * 60 * 1000);
  }

  // ── !help ────────────────────────────────────────────────────────
  if (command === '!help') {
    message.reply({ embeds: [new EmbedBuilder()
      .setTitle('☁️ Luna\'s Cafe — Commands')
      .setDescription(
        `**Setup**\n` +
        `\`!rules\` · \`!setup\` · \`!announce <msg>\` · \`!ordersetup\` · \`!say <msg>\`\n\n` +
        `**Applications**\n` +
        `\`!apply\` — Apply for staff or GFX artist via DM\n\n` +
        `**GFX**\n` +
        `\`!status <comm> <req>\` — open / close / limited\n\n` +
        `**Leveling**\n` +
        `\`!rank [@user]\` · \`!leaderboard\` · \`!setlevel @user <n>\`\n\n` +
        `**Giveaway**\n` +
        `\`!giveaway <minutes> <prize>\`\n\n` +
        `**Info**\n` +
        `\`!serverinfo\` · \`!userinfo [@user]\` · \`!ping\`\n\n` +
        `**Moderation**\n` +
        `\`!kick\` · \`!ban\` · \`!unban\` · \`!timeout\` · \`!untimeout\`\n` +
        `\`!warn\` · \`!purge <1-100>\` · \`!closeticket\` · \`!nuke\`\n\n` +
        `**Fun**\n` +
        `\`!hug\` · \`!pat\` · \`!cuddle\` · \`!slap\` · \`!boop\` · \`!wave\`\n` +
        `\`!8ball <q>\` · \`!coinflip\` · \`!quote\`\n`
      )
      .setColor(C_MAIN)
      .setFooter({ text: 'Luna\'s Cafe ☁️' })] });
  }
});

// ─── BUTTON INTERACTIONS ──────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // ── Verify ───────────────────────────────────────────────────────
  if (interaction.customId === 'verify') {
    try {
      await interaction.member.roles.add(VERIFIED_ROLE_ID);
      await interaction.reply({ content: '☁️ Welcome to Luna\'s Cafe! Enjoy your stay ʚɞ', ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Something went wrong. Please contact an admin.', ephemeral: true });
    }
  }

  // ── Apply buttons ─────────────────────────────────────────────────
  if (interaction.customId === 'apply_staff' || interaction.customId === 'apply_gfx') {
    const type = interaction.customId === 'apply_staff' ? 'staff' : 'gfx';
    if (activeApplications.has(interaction.user.id))
      return interaction.reply({ content: '⚠️ You already have an application in progress! Check your DMs ☁️', ephemeral: true });
    try {
      const questions = type === 'staff' ? staffQuestions : gfxQuestions;
      await interaction.user.send({ embeds: [new EmbedBuilder()
        .setTitle(`${type === 'staff' ? '🛡️ Staff' : '🎨 GFX Artist'} Application — Luna's Cafe`)
        .setDescription(
          `hey! ☁️ thanks for applying!\n\n` +
          `i'll ask you **${questions.length} questions** — just reply to each one here in DMs.\n\n` +
          `**Question 1/${questions.length}**\n\n${questions[0]}`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Cafe ☁️ • type your answer below" })] });
      activeApplications.set(interaction.user.id, { type, answers: [], step: 0 });
      await interaction.reply({ content: '✅ Check your DMs! Your application has started ☁️', ephemeral: true });
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
            `hey ${interaction.user}! ☁️ welcome to your order ticket!\n\n` +
            `please fill in the following:\n\n` +
            `🖼️ **Type** — pfp, banner, logo, etc.\n` +
            `🎨 **Style** — colours, theme, vibe\n` +
            `📝 **Details** — text, references, extra info\n` +
            `⏰ **Deadline** — when do you need it?\n\n` +
            `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
            `staff will be with you shortly! 🌸\n` +
            `use \`!closeticket\` to close this ticket.`
          )
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Cafe ☁️" })]
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
      return interaction.reply({ content: '🍀 You\'re already entered! Good luck ☁️', ephemeral: true });
    giveaway.participants.add(interaction.user.id);
    await interaction.message.edit({ embeds: [new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(
        `🎁 **Prize:** ${giveaway.prize}\n\n` +
        `⏰ **Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R> (<t:${Math.floor(giveaway.endTime / 1000)}:f>)\n` +
        `👥 **Participants:** ${giveaway.participants.size}\n\n` +
        `╰┈➤ click the button below to enter! 🍀`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Cafe ☁️ • Good luck!" })] });
    await interaction.reply({ content: '🎉 You\'ve entered the giveaway! Good luck! 🍀', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
