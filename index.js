require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User
  ]
});

// ─── CONSTANTS ───────────────────────────────────────────────────
const VERIFIED_ROLE_ID      = '1470764529372762145';
const WELCOME_CHANNEL_ID    = '1504207642464092301';
const STATUS_CHANNEL_ID     = '1490337482548711434';
const ANNOUNCE_CHANNEL_ID   = '1504211471737819207';
const APPS_CHANNEL_ID       = '1470769330164732149';
const PARTNER_CHANNEL_ID    = '1504212721325834402';
const SHOP_CHANNEL_ID       = '1504210932484669590';
const ANNOUNCE_IMAGE        = 'https://media.discordapp.net/attachments/1439309522610028594/1488384922090602586/1_cinnamoroll.gif?ex=69e8457a&is=69e6f3fa&hm=79ebcfb7182575e1cd5e0c171b87ab92e1018d4d8fa4a4a9adcffd3b38b82f91&=';

const MODMAIL_CHANNEL_ID    = '1502639754275979294';
const BOOST_CHANNEL_ID      = '1504208837924749332';
const ANTIJOIN_CHANNEL_ID   = '1504898670644953229';
const TICKET_CHANNEL_ID     = '1504210932484669590';
const BOOST_LEVEL           = 10;
const SERVER_INVITE         = 'https://discord.gg/K8YS9w9hk2';

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
const pendingApplications = new Map(); // messageId -> { userId, type, tag }
const modmailSessions     = new Map(); // userId -> threadId (open modmails)
const modmailPending      = new Set(); // userId (awaiting yes/no prompt)
let   partnerCount       = 0;
const robloxVerified     = new Map(); // userId -> { username, robloxId }
const robloxPending      = new Map(); // userId -> { username, robloxId, code }
let   requestCount       = 0;

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
  channel.send(`-# ⠀⠀ ༷   welcome ⠀⠀ ּ𓏼 ${member}`);
});

// ─── BOOST ────────────────────────────────────────────────────────
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const wasBoosting = oldMember.premiumSince;
  const isBoosting  = newMember.premiumSince;
  if (!wasBoosting && isBoosting) {
    // Give level 10
    xpData.set(newMember.id, { xp: 0, level: BOOST_LEVEL });

    const boostChannel = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
    if (boostChannel) {
      boostChannel.send({ embeds: [new EmbedBuilder()
        .setDescription(
          `̥̈◟ ͜𓏼˚ ty for boosting, ${newMember}!\n\n` +
          `꒰っ.､꒱ check booster perks\n` +
          `𐂯 ﹒ open a ticket and claim **XP**\n` +
          `z☡z ﹒ choose a __custom__ role in booster chat`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️" })] });
    }
  }
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ── DM Handler (modmail + applications) ──────────────────────────
  if (message.channel.type === ChannelType.DM) {

    // ── Active application? handle it first ──────────────────────────
    const app = activeApplications.get(message.author.id);
    if (app) {
      app.answers.push(message.content);
      const questions = app.type === 'staff' ? staffQuestions : gfxQuestions;
      if (app.step < questions.length - 1) {
        app.step++;
        activeApplications.set(message.author.id, app);
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setDescription(`**Question ${app.step + 1}/${questions.length}**\n\n${questions[app.step]}`)
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️ • type your answer below" })] });
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
        const appButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`app_accept_${message.author.id}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`app_deny_${message.author.id}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger)
        );
        if (appsChannel) {
          const appMsg = await appsChannel.send({ embeds: [resultEmbed], components: [appButtons] });
          pendingApplications.set(appMsg.id, { userId: message.author.id, type: app.type, tag: message.author.tag });
        }
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle('✅ Application Submitted!')
          .setDescription(`thank you for applying to **Luna's Shop**! ☁️🌸\nyour application has been sent to our staff team.\nwe'll get back to you soon! ʚɞ`)
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️" })] });
      }
      return;
    }

    // ── Active modmail? relay message to thread ───────────────────────
    if (modmailSessions.has(message.author.id)) {
      const threadId = modmailSessions.get(message.author.id);
      const guild = client.guilds.cache.first();
      try {
        const thread = await guild.channels.fetch(threadId);
        if (!thread) {
          modmailSessions.delete(message.author.id);
          return;
        }
        await thread.send({ embeds: [new EmbedBuilder()
          .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
          .setDescription(message.content || '*[attachment or embed]*')
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️ • user message" })
          .setTimestamp()] });
        // forward attachments
        if (message.attachments.size > 0) {
          const urls = message.attachments.map(a => a.url).join('\n');
          await thread.send(`📎 **Attachment(s):**\n${urls}`);
        }
      } catch (e) {
        console.error('Modmail relay error:', e);
      }
      return;
    }

    // ── Awaiting modmail prompt? ignore further messages ──────────────
    if (modmailPending.has(message.author.id)) return;

    // ── New DM — ask if they want to open a modmail ───────────────────
    modmailPending.add(message.author.id);
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('📬 Luna\'s Shop — Modmail')
        .setDescription(
          `☁️ hey **${message.author.username}**! 🌸\n\n` +
          `would you like to open a **modmail ticket**?\n` +
          `our staff team will assist you as soon as possible!\n\n` +
          `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
          `╰┈➤ *click a button below to continue* ☁️`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • modmail" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('modmail_open').setLabel('✅ Yes, open a ticket').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('modmail_cancel').setLabel('❌ No thanks').setStyle(ButtonStyle.Secondary)
      )]
    });
    return;
  }

  // ── Forum thread relay (staff → user DM) ─────────────────────────
  if (message.channel.isThread?.() && message.channel.parentId === MODMAIL_CHANNEL_ID) {
    // Find user from modmailSessions by threadId
    const userId = [...modmailSessions.entries()].find(([, tid]) => tid === message.channel.id)?.[0];
    if (!userId) return;
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [new EmbedBuilder()
        .setAuthor({ name: `${message.author.tag} · Staff`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(message.content || '*[attachment or embed]*')
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • staff reply" })
        .setTimestamp()] });
      if (message.attachments.size > 0) {
        const urls = message.attachments.map(a => a.url).join('\n');
        await user.send(`📎 **Attachment(s):**\n${urls}`);
      }
    } catch (e) {
      await message.channel.send({ embeds: [embed('⚠️ Could not DM this user — they may have DMs closed.', C_WARN)] });
    }
    return;
  }

  // ── Anti-join/bot trap channel ───────────────────────────────────
  if (message.channel.id === ANTIJOIN_CHANNEL_ID) {
    try {
      const member = message.guild.members.cache.get(message.author.id);
      if (member) {
        // Delete all their messages in that channel
        const msgs = await message.channel.messages.fetch({ limit: 100 });
        const userMsgs = msgs.filter(m => m.author.id === message.author.id);
        if (userMsgs.size > 0) await message.channel.bulkDelete(userMsgs, true).catch(() => {});
        // DM them the invite first
        try {
          await message.author.send({ embeds: [new EmbedBuilder()
            .setTitle('⚠️ You have been kicked')
            .setDescription(
              `you were kicked from the server for triggering a protected channel.\n\n` +
              `if this was a mistake, you are welcome to rejoin:\n${SERVER_INVITE}`
            )
            .setColor(C_ERROR)] });
        } catch {}
        // Kick
        await member.kick('Triggered anti-bot/hacked account channel');
      }
    } catch (e) { console.error('Antijoin error:', e); }
    return;
  }

  // ── !ticketpanel ──────────────────────────────────────────────────
  if (command === '!ticketpanel') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🎫 Tickets — Luna\'s Shop')
        .setDescription(
          `⬚　﹑　 　　need help? open a ticket!\n` +
          `　﹒　┆﹒　our staff will assist you shortly\n\n` +
          `　𐂯　﹑　　　click the button below to create\n` +
          `　　　　　a private ticket channel　　꒰っ.､꒱\n\n` +
          `　z☡z　﹑　 　　please be patient & descriptive\n` +
          `　﹒　┆﹒　one ticket at a time please!`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary)
      )]
    });
    await message.delete();
  }

  // ── Partner count tracker ─────────────────────────────────────────
  if (message.channel.id === PARTNER_CHANNEL_ID) {
    partnerCount++;
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🤝 Partnership')
      .setDescription(`🌸 **Partner Count : ${partnerCount}**\n\nthank you for partnering with Luna's Cafe! ☁️✨`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️" })] });
    return;
  }

  // ── Shop request system (.req) ────────────────────────────────────
  if (message.channel.id === SHOP_CHANNEL_ID && message.content.toLowerCase().startsWith('.req ')) {
    const details = message.content.slice(5).trim();
    if (!details) {
      const warn = await message.reply({ content: '⚠️ Usage: `.req <your request details>`', flags: 64 });
      return;
    }
    requestCount++;
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setAuthor({ name: "Luna's Shop ☁️🛍️", iconURL: message.guild.iconURL({ dynamic: true }) })
      .setTitle(`🛍️ New Request — #${requestCount}`)
      .setDescription(
        `﹒₊˚ʚ﹕🧁-ɞ-﹒-request\n\n` +
        `👤 **Request From :** ${message.author}\n` +
        `✨ **Details :**\n${details}\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *staff will review your request soon!* ☁️🌸`
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setColor(C_MAIN)
      .setFooter({ text: `Luna's Shop ☁️ • request #${requestCount}` })
      .setTimestamp()] });
    return;
  }

  // ── Block non-.req messages in shop channel (optional: only allow commands) ─
  // (we still let commands through below)

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
        .setFooter({ text: "Luna's Shop ☁️" })] });
    }
    xpData.set(message.author.id, userData);
  }

  // ── !rules ───────────────────────────────────────────────────────
  if (command === '!rules') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setDescription(
        `⬚　﹑　 　　do not steal __ser__ver __lay__outs\n` +
        `　　　　this includes inspiration, none of the layouts are f2u\n` +
        `　﹒　┆﹒\n` +
        `　no __big__otry, or __ha__te speech　　𓈃\n` +
        `　　slurs will not be tolerated, neither will any other form of hate speech\n` +
        `　𐂯　﹑　　　 　﹒　┆﹒\n` +
        `　no __mis__use of pings　　𝛝𝛠\n` +
        `　　use autoresponders as intended\n` +
        `　z☡z　﹑　 　　use common sense\n` +
        `　　even if a rule isnt listed, that dosent mean it dosent apply\n` +
        `　﹒　┆﹒\n` +
        `　strictly ntox, & __completely__ sfw　　꒰っ.､꒱\n` +
        `　　no bullying, gore, nsfw, or sensitive topics`
      )
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
        .setFooter({ text: "Luna's Shop ☁️ • applications are sent via DM" })],
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
        .setFooter({ text: "Luna's Shop ☁️" })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_order').setLabel('🎨 Create Order').setStyle(ButtonStyle.Primary)
      )]
    });
    await message.delete();
  }

  // ── !verify ───────────────────────────────────────────────────────
  if (command === '!verify') {
    const username = args[1];
    if (!username) return message.reply('⚠️ Usage: `!verify <roblox username>`');

    if (robloxVerified.has(message.author.id))
      return message.reply({ embeds: [embed(`✅ You are already verified as **${robloxVerified.get(message.author.id).username}** on Roblox! Use \`!unverify\` to unlink.`, C_MAIN)] });

    try {
      // Look up Roblox user ID from username
      const searchRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
      });
      const searchData = await searchRes.json();
      if (!searchData.data || searchData.data.length === 0)
        return message.reply({ embeds: [embed(`❌ Roblox user **${username}** not found. Check the spelling!`, C_ERROR)] });

      const robloxUser = searchData.data[0];
      const code = `luna-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      robloxPending.set(message.author.id, { username: robloxUser.name, robloxId: robloxUser.id, code });

      // 10 min timeout
      setTimeout(() => robloxPending.delete(message.author.id), 10 * 60 * 1000);

      await message.reply({ embeds: [new EmbedBuilder()
        .setTitle('🎮 Roblox Verification')
        .setDescription(
          `⬚　﹑　 　　hey **${message.author.username}**! ☁️\n` +
          `　﹒　┆﹒　here's how to verify your Roblox account\n\n` +
          `**Step 1:** go to your Roblox profile\n` +
          `**Step 2:** edit your **bio/description**\n` +
          `**Step 3:** paste this code anywhere in your bio:\n\n` +
          `\`\`\`${code}\`\`\`` +
          `\n**Step 4:** type \`!verified\` here when done!\n\n` +
          `　z☡z　﹑　 　　code expires in **10 minutes**\n` +
          `　﹒　┆﹒　linking to: **${robloxUser.name}** (ID: ${robloxUser.id})`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • roblox verification" })] });
    } catch (e) {
      console.error('Roblox verify error:', e);
      message.reply({ embeds: [embed('❌ Could not reach the Roblox API. Try again in a moment!', C_ERROR)] });
    }
  }

  // ── !verified ─────────────────────────────────────────────────────
  if (command === '!verified') {
    const pending = robloxPending.get(message.author.id);
    if (!pending) return message.reply({ embeds: [embed('⚠️ No pending verification found. Use `!verify <username>` first!', C_WARN)] });

    try {
      // Fetch Roblox profile description
      const profileRes = await fetch(`https://users.roblox.com/v1/users/${pending.robloxId}`);
      const profileData = await profileRes.json();
      const bio = profileData.description || '';

      if (!bio.includes(pending.code)) {
        return message.reply({ embeds: [new EmbedBuilder()
          .setTitle('❌ Code Not Found')
          .setDescription(
            `　z☡z　﹑　 　　your code wasn't found in your bio!\n\n` +
            `make sure your bio contains:\n\`\`\`${pending.code}\`\`\`` +
            `\nthen try \`!verified\` again. code expires in 10 minutes!`
          )
          .setColor(C_ERROR)
          .setFooter({ text: "Luna's Shop ☁️ • roblox verification" })] });
      }

      // Success!
      robloxPending.delete(message.author.id);
      robloxVerified.set(message.author.id, { username: pending.username, robloxId: pending.robloxId });

      await message.reply({ embeds: [new EmbedBuilder()
        .setTitle('✅ Verified!')
        .setDescription(
          `⬚　﹑　 　　welcome **${pending.username}**! ☁️🌸\n` +
          `　﹒　┆﹒　your Roblox account is now linked!\n\n` +
          `　𐂯　﹑　　　you can now remove the code from your bio\n` +
          `　　　　　if you'd like　　꒰っ.､꒱\n\n` +
          `use \`!roblox\` to view your profile anytime!`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • roblox verified ✅" })] });
    } catch (e) {
      console.error('Roblox verified error:', e);
      message.reply({ embeds: [embed('❌ Could not reach the Roblox API. Try again in a moment!', C_ERROR)] });
    }
  }

  // ── !roblox ───────────────────────────────────────────────────────
  if (command === '!roblox') {
    const target = message.mentions.users.first() || message.author;
    const data = robloxVerified.get(target.id);
    if (!data) return message.reply({ embeds: [embed(`❌ **${target.username}** hasn't verified their Roblox account yet. Use \`!verify <username>\` to link!`, C_WARN)] });

    try {
      const profileRes = await fetch(`https://users.roblox.com/v1/users/${data.robloxId}`);
      const profile = await profileRes.json();
      const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${data.robloxId}&size=150x150&format=Png`);
      const thumbData = await thumbRes.json();
      const avatar = thumbData.data?.[0]?.imageUrl || null;

      await message.channel.send({ embeds: [new EmbedBuilder()
        .setTitle(`🎮 ${profile.name}'s Roblox Profile`)
        .setDescription(
          `⬚　﹑　 　　linked to **${target.username}**\n` +
          `　﹒　┆﹒\n\n` +
          `　𐂯　﹑　**Username:** ${profile.name}\n` +
          `　𐂯　﹑　**Display Name:** ${profile.displayName}\n` +
          `　𐂯　﹑　**User ID:** ${data.robloxId}\n` +
          `　𐂯　﹑　**Joined:** ${new Date(profile.created).toLocaleDateString()}\n\n` +
          `　z☡z　﹑　[view profile](https://www.roblox.com/users/${data.robloxId}/profile)`
        )
        .setThumbnail(avatar)
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • roblox verification" })] });
    } catch (e) {
      message.channel.send({ embeds: [embed(`🎮 **${target.username}** is verified as **${data.username}** on Roblox!`, C_MAIN)] });
    }
  }

  // ── !unverify ─────────────────────────────────────────────────────
  if (command === '!unverify') {
    if (!robloxVerified.has(message.author.id))
      return message.reply({ embeds: [embed("⚠️ You don't have a linked Roblox account!", C_WARN)] });
    const data = robloxVerified.get(message.author.id);
    robloxVerified.delete(message.author.id);
    message.reply({ embeds: [embed(`✅ Unlinked your Roblox account (**${data.username}**). You can re-verify anytime with \`!verify\`!`, C_MAIN)] });
  }

  // ── !whois ────────────────────────────────────────────────────────
  if (command === '!whois') {
    const robloxName = args[1];
    if (!robloxName) return message.reply('⚠️ Usage: `!whois <roblox username>`');
    // Find discord user linked to this roblox name
    const found = [...robloxVerified.entries()].find(([, d]) => d.username.toLowerCase() === robloxName.toLowerCase());
    if (!found) return message.reply({ embeds: [embed(`❌ No Discord user has linked **${robloxName}** as their Roblox account.`, C_WARN)] });
    message.channel.send({ embeds: [embed(`🎮 **${robloxName}** is linked to <@${found[0]}> on Discord!`, C_MAIN)] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
      .setFooter({ text: "Luna's Shop ☁️" })] });
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
        .setFooter({ text: "Luna's Shop ☁️ • Good luck!" })],
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
          .setFooter({ text: "Luna's Shop ☁️" })], components: [disabledBtn] });
      } else {
        const winner = participants[Math.floor(Math.random() * participants.length)];
        await giveawayMsg.edit({ embeds: [new EmbedBuilder()
          .setTitle('🎉 GIVEAWAY ENDED 🎉')
          .setDescription(`🎁 **Prize:** ${prize}\n\n🏆 **Winner:** <@${winner}>\n👥 **Participants:** ${participants.length}`)
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️" })], components: [disabledBtn] });
        message.channel.send(`🎉 Congrats <@${winner}>! You won **${prize}**! ☁️🎁`);
      }
      activeGiveaways.delete(giveawayMsg.id);
    }, minutes * 60 * 1000);
  }

  // ── !staffg ───────────────────────────────────────────────────────
  if (command === '!staffg') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🛡️ Staff Guide — Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *welcome to the team! here's everything you need to know* ☁️\n\n` +
        `**📌 Your Role**\n` +
        `As staff, you are the backbone of Luna's Cafe. Your job is to keep the server safe, welcoming, and cozy for everyone.\n\n` +
        `**📋 Responsibilities**\n` +
        `🌸 Monitor chats and enforce the rules fairly\n` +
        `⚠️ Issue warnings for minor rule breaks (\`!warn\`)\n` +
        `⏳ Use timeouts for repeated offenses (\`!timeout\`)\n` +
        `🚫 Escalate serious cases to senior staff or owner\n` +
        `💬 Be welcoming to new members\n` +
        `🧹 Keep channels clean with \`!purge\` when needed\n\n` +
        `**📌 Golden Rules**\n` +
        `☁️ Never abuse your permissions\n` +
        `☁️ Always be professional and kind\n` +
        `☁️ If unsure, ask before acting\n` +
        `☁️ Stay active — inactivity may result in demotion\n` +
        `☁️ Lead by example — you represent Luna's Cafe\n\n` +
        `**🛠️ Staff Commands**\n` +
        `\`!warn\` \`!kick\` \`!ban\` \`!timeout\` \`!untimeout\` \`!purge\` \`!nuke\` \`!closeticket\`\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *thank you for being part of the team! ☕🌸*`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • Staff Guide" })] });
    await message.delete();
  }

  // ── !ownerg ───────────────────────────────────────────────────────
  if (command === '!ownerg') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('👑 Owner Guide — Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *the full guide for running Luna's Cafe* ☁️\n\n` +
        `**👑 Your Responsibilities**\n` +
        `As owner, you are responsible for the overall direction, culture, and safety of the server.\n\n` +
        `**📋 Key Duties**\n` +
        `🌸 Set the tone — your attitude shapes the community\n` +
        `🛡️ Manage and support your staff team\n` +
        `📢 Keep announcements and events active\n` +
        `🤝 Handle partnerships thoughtfully\n` +
        `🎨 Oversee GFX quality and commissions\n` +
        `⚖️ Handle escalated moderation cases\n` +
        `📊 Review applications with care\n\n` +
        `**📌 Best Practices**\n` +
        `☁️ Be transparent with your team\n` +
        `☁️ Promote staff who show dedication\n` +
        `☁️ Hold regular events to keep the server active\n` +
        `☁️ Check the applications channel regularly\n` +
        `☁️ Keep the server organised and cozy\n\n` +
        `**🛠️ Owner Commands**\n` +
        `\`!announce\` \`!setup\` \`!rules\` \`!ordersetup\` \`!staffg\` \`!eventg\`\n` +
        `\`!setlevel\` \`!nuke\` \`!status\` \`!giveaway\` \`!say\`\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *Luna's Cafe is yours to nurture — make it shine! ☕✨*`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • Owner Guide" })] });
    await message.delete();
  }

  // ── !eventg ───────────────────────────────────────────────────────
  if (command === '!eventg') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🎪 Event Guide — Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *how to host events at Luna's Cafe* ☁️\n\n` +
        `**📋 Before the Event**\n` +
        `📢 Announce it at least **24 hours** in advance using \`!announce\`\n` +
        `📌 Confirm the date, time and timezone clearly\n` +
        `🎁 Prepare prizes or rewards if applicable\n` +
        `✅ Get approval from owner before posting\n\n` +
        `**🎪 During the Event**\n` +
        `🌸 Be present and actively manage the event\n` +
        `⚠️ Enforce rules — no trolling or disruption\n` +
        `🧹 Keep the channel clean and on-topic\n` +
        `🎉 Keep energy high and make it fun!\n\n` +
        `**📌 After the Event**\n` +
        `🏆 Announce winners promptly and fairly\n` +
        `💬 Thank everyone for participating\n` +
        `📝 Report any issues to the owner\n\n` +
        `**🎮 Event Types**\n` +
        `🌾 DTI Farming Events — \`!farming\`\n` +
        `🎡 DTI Fair Events — \`!fair\`\n` +
        `🎉 Giveaways — \`!giveaway <mins> <prize>\`\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *great events make great communities! ☕🎊*`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • Event Guide" })] });
    await message.delete();
  }

  // ── !farming ──────────────────────────────────────────────────────
  if (command === '!farming') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const details = args.slice(1).join(' ');
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🌾 DTI Farming Event — Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *a farming event is being hosted!* ☁️🌾\n\n` +
        `🌱 **Event:** DTI Farming\n` +
        `📝 **Details:** ${details || 'check with staff for more info!'}\n\n` +
        `**How it works:**\n` +
        `🌾 Join the farming session and collect resources together!\n` +
        `🤝 Help each other out — teamwork makes it easier\n` +
        `🎁 Rewards may be given for top farmers!\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *come join the fun! ☕🌸*`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • DTI Event" })
      .setTimestamp()] });
    await message.delete();
  }

  // ── !fair ─────────────────────────────────────────────────────────
  if (command === '!fair') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const details = args.slice(1).join(' ');
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🎡 DTI Fair Event — Luna\'s Cafe')
      .setDescription(
        `╰┈➤ *a fair event is being hosted!* ☁️🎡\n\n` +
        `🎪 **Event:** DTI Fair\n` +
        `📝 **Details:** ${details || 'check with staff for more info!'}\n\n` +
        `**How it works:**\n` +
        `🎡 Visit the fair and enjoy all the activities!\n` +
        `🛍️ Trade, collect, and have fun with others\n` +
        `🎁 Special prizes available at the fair!\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *see you at the fair! ☕🎊*`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • DTI Event" })
      .setTimestamp()] });
    await message.delete();
  }

  // ── !slowmode ─────────────────────────────────────────────────────
  if (command === '!slowmode') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return message.reply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
    const seconds = parseInt(args[1]);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600)
      return message.reply('⚠️ Usage: `!slowmode <seconds>` (0 to disable, max 21600)');
    await message.channel.setRateLimitPerUser(seconds);
    message.channel.send({ embeds: [embed(
      seconds === 0 ? '✅ Slowmode disabled.' : `🐌 Slowmode set to **${seconds} seconds**.`,
      C_MAIN
    )] });
  }

  // ── !lock / !unlock ───────────────────────────────────────────────
  if (command === '!lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return message.reply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
    message.channel.send({ embeds: [embed('🔒 Channel locked. Only staff can send messages.', C_MAIN)] });
  }

  if (command === '!unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return message.reply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
    message.channel.send({ embeds: [embed('🔓 Channel unlocked! Welcome back everyone ☁️', C_MAIN)] });
  }

  // ── !emoji ────────────────────────────────────────────────────────
  if (command === '!emoji') {
    const emojis = ['☁️','🌸','☕','🍰','🫧','✨','🤍','🌤️','🍵','🌷','🎀','🪷','🩵','💙','🫶'];
    const random = Array.from({length: 5}, () => emojis[Math.floor(Math.random() * emojis.length)]).join(' ');
    message.channel.send({ embeds: [embed(`your daily cafe vibes: ${random}`, C_MAIN)] });
  }

  // ── !ship ─────────────────────────────────────────────────────────
  if (command === '!ship') {
    const user1 = message.mentions.users.first();
    const user2 = message.mentions.users.at(1) || message.author;
    if (!user1) return message.reply('⚠️ Usage: `!ship @user1 @user2`');
    const percent = Math.floor(Math.random() * 101);
    const hearts = percent >= 80 ? '💙💙💙💙💙' : percent >= 60 ? '💙💙💙💙🤍' : percent >= 40 ? '💙💙💙🤍🤍' : percent >= 20 ? '💙💙🤍🤍🤍' : '💙🤍🤍🤍🤍';
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('💙 Ship Calculator')
      .setDescription(`**${user1.username}** 🤝 **${user2.username}**\n\n${hearts}\n\n**${percent}%** compatibility! ${percent >= 70 ? '☁️ meant to be!' : percent >= 40 ? '🌸 pretty cute!' : '🍵 maybe just friends!'}`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️" })] });
  }

  // ── !topic ────────────────────────────────────────────────────────
  if (command === '!topic') {
    const topics = [
      'What\'s your favourite cafe drink? ☕',
      'If you could live in any fictional world, which would it be? 🌸',
      'What song are you currently obsessed with? 🎵',
      'Describe your dream bedroom aesthetic! ☁️',
      'What\'s your comfort show or movie? 🍵',
      'If you opened a cafe, what would you name it? ☕',
      'What\'s your go-to cozy activity? 🤍',
      'Morning person or night owl? 🌙',
      'What\'s the last thing that made you smile? 🌷',
      'If you were a dessert, what would you be? 🍰'
    ];
    const t = topics[Math.floor(Math.random() * topics.length)];
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('💬 Conversation Topic')
      .setDescription(`*${t}*`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️" })] });
  }

  // ── !activity ─────────────────────────────────────────────────────
  if (command === '!activity') {
    const activities = [
      '🎨 Share your GFX work in the art channel!',
      '☕ Tell us your favourite cafe order!',
      '🌸 Compliment someone in the server today!',
      '🎵 Drop a song recommendation!',
      '🍰 Share a recipe you love!',
      '☁️ Post a picture that gives you cozy vibes!',
      '🌷 What are you grateful for today?',
      '🤍 Give someone a kind word — it goes a long way!'
    ];
    const a = activities[Math.floor(Math.random() * activities.length)];
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🌸 Server Activity')
      .setDescription(`*${a}*`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • let's get chatting!" })] });
  }

  // ── !closemodmail ─────────────────────────────────────────────────
  if (command === '!closemodmail') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    if (!message.channel.isThread?.() || message.channel.parentId !== MODMAIL_CHANNEL_ID)
      return message.reply('❌ Run this inside a modmail thread.');
    const userId = [...modmailSessions.entries()].find(([, tid]) => tid === message.channel.id)?.[0];
    if (userId) {
      modmailSessions.delete(userId);
      try {
        const user = await client.users.fetch(userId);
        await user.send({ embeds: [new EmbedBuilder()
          .setTitle('🔒 Modmail Closed')
          .setDescription(`hey **${user.username}**! ☁️\n\nyour modmail ticket has been **closed** by staff.\nif you need further help, feel free to DM me again! 🌸`)
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️" })] });
      } catch {}
    }
    await message.channel.send({ embeds: [embed('🔒 Modmail closed. Thread will be archived shortly. ☁️', C_MAIN)] });
    setTimeout(async () => { try { await message.channel.setArchived(true); } catch {} }, 3000);
  }

  // ── !help ────────────────────────────────────────────────────────
  if (command === '!shopsetup') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setAuthor({ name: "Luna's Shop ☁️🛍️", iconURL: message.guild.iconURL({ dynamic: true }) })
      .setTitle(`🛍️ Welcome to Luna's Shop!`)
      .setDescription(
        `﹒₊˚ʚ﹕🧁-ɞ-﹒-shop\n\n` +
        `*hello and welcome to our cozy little shop!* ☁️✨\n\n` +
        `🧸 **How to request:**\n` +
        `type \`.req (your details)\` to submit a request!\n\n` +
        `🎀 **What we offer:**\n` +
        `🖼️ Profile Pictures (PFPs)\n` +
        `🎨 Banners & Headers\n` +
        `✨ Logos & Icons\n` +
        `🍰 Custom GFX on request\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *please be patient — we'll get to you soon!* ☕🌸`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️ • use .req to order!" })] });
    await message.delete();
  }

  // ── !shopclear ────────────────────────────────────────────────────
  if (command === '!shopclear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    requestCount = 0;
    message.reply({ embeds: [embed('✅ Request counter reset to 0.', C_MAIN)], flags: 64 });
  }

  // ── !reqcount ─────────────────────────────────────────────────────
  if (command === '!reqcount') {
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle(`🛍️ Luna's Shop — Request Count`)
      .setDescription(`╰┈➤ *we've received a total of* **${requestCount}** *requests so far!* ☁️🧁`)
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️" })] });
  }

  // ── !shopclaim @user ──────────────────────────────────────────────
  if (command === '!shopclaim') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const target = message.mentions.users.first();
    if (!target) return message.reply('⚠️ Usage: `!shopclaim @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('🎨 Request Claimed!')
      .setDescription(
        `☁️ **${message.author.username}** has claimed the request from **${target.username}**!\n\n` +
        `🌸 Your request is being worked on — please be patient! ʚɞ\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *we'll notify you when it's ready!* ☁️✨`
      )
      .setColor(C_MAIN)
      .setFooter({ text: "Luna's Shop ☁️" })] });
  }

  // ── !shopdone @user ───────────────────────────────────────────────
  if (command === '!shopdone') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return message.reply({ content: '❌ You need **Manage Server** permission.', flags: 64 });
    const target = message.mentions.users.first();
    if (!target) return message.reply('⚠️ Usage: `!shopdone @user`');
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle('✅ Request Complete!')
      .setDescription(
        `🎉 hey ${target}! your request has been completed! ☁️🎨\n\n` +
        `🌸 thank you for shopping at **Luna's Shop**!\n` +
        `☁️ we hope you love it! ʚɞ\n\n` +
        `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
        `╰┈➤ *come back anytime!* 🧁✨`
      )
      .setColor(C_SUCCESS)
      .setFooter({ text: "Luna's Shop ☁️" })] });
  }

  // ── !help ────────────────────────────────────────────────────────
  if (command === '!help') {
    message.reply({ embeds: [new EmbedBuilder()
      .setTitle('☁️ Luna\'s Cafe — Commands')
      .setDescription(
        `**Setup**\n` +
        `\`!rules\` · \`!setup\` · \`!announce <msg>\` · \`!ordersetup\` · \`!say <msg>\`\n\n` +
        `**🛍️ Shop**\n` +
        `\`.req <details>\` — Submit a shop request (in shop channel)\n` +
        `\`!shopsetup\` — Post the shop welcome embed\n` +
        `\`!reqcount\` — Show total request count\n` +
        `\`!shopclaim @user\` — Claim a request\n` +
        `\`!shopdone @user\` — Mark a request as done\n` +
        `\`!shopclear\` — Reset request counter\n\n` +
        `**Guides** *(admin sends, everyone sees)*\n` +
        `\`!staffg\` · \`!ownerg\` · \`!eventg\`\n\n` +
        `**DTI Events**\n` +
        `\`!farming [details]\` · \`!fair [details]\`\n\n` +
        `**🎮 Roblox**\n` +
        `\`!verify <username>\` — link your Roblox account\n` +
        `\`!verified\` — confirm after adding the code to your bio\n` +
        `\`!roblox [@user]\` — view linked Roblox profile\n` +
        `\`!unverify\` — unlink your account\n` +
        `\`!whois <roblox username>\` — find who owns a Roblox account\n\n` +
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
        `\`!warn\` · \`!purge\` · \`!nuke\` · \`!closeticket\`\n` +
        `\`!lock\` · \`!unlock\` · \`!slowmode <secs>\`\n\n` +
        `**📬 Modmail**\n` +
        `\`!closemodmail\` — Close & archive a modmail thread\n\n` +
        `**Fun**\n` +
        `\`!hug\` · \`!pat\` · \`!cuddle\` · \`!slap\` · \`!boop\` · \`!wave\`\n` +
        `\`!ship @u1 @u2\` · \`!8ball <q>\` · \`!coinflip\` · \`!quote\`\n` +
        `\`!topic\` · \`!activity\` · \`!emoji\`\n`
      )
      .setColor(C_MAIN)
      .setFooter({ text: 'Luna\'s Cafe ☁️' })] });
  }
});

// ─── BUTTON INTERACTIONS ──────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // ── Modmail Open ──────────────────────────────────────────────────
  if (interaction.customId === 'modmail_open') {
    modmailPending.delete(interaction.user.id);

    if (modmailSessions.has(interaction.user.id)) {
      await interaction.update({ components: [] });
      return interaction.followUp({ content: '⚠️ You already have an open modmail ticket! Just send me a message here ☁️', ephemeral: true });
    }

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle('📬 Modmail Opened!')
        .setDescription(
          `☁️ your modmail ticket has been opened! 🌸\n\n` +
          `our staff will assist you shortly.\n` +
          `just **send messages here** and they'll be forwarded to staff!\n\n` +
          `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
          `╰┈➤ *we'll get back to you as soon as possible* ☁️`
        )
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • modmail" })],
      components: []
    });

    try {
      const guild = client.guilds.cache.first();
      const modmailChannel = await guild.channels.fetch(MODMAIL_CHANNEL_ID);

      const starterMsg = await modmailChannel.send({ embeds: [new EmbedBuilder()
        .setTitle('📬 New Modmail Ticket')
        .setDescription(
          `╰┈➤ *new modmail opened* ☁️🌸\n\n` +
          `👤 **User:** ${interaction.user.tag} (<@${interaction.user.id}>)\n` +
          `🆔 **User ID:** ${interaction.user.id}\n` +
          `📅 **Opened:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
          `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏\n` +
          `reply in this thread to chat with the user.\n` +
          `use \`!closemodmail\` to close this ticket.`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️ • modmail system" })
        .setTimestamp()] });

      const thread = await starterMsg.startThread({
        name: `${interaction.user.username}'s modmail`,
        autoArchiveDuration: 10080
      });

      modmailSessions.set(interaction.user.id, thread.id);
    } catch (e) {
      console.error('Modmail thread creation error:', e);
      await interaction.followUp({ content: '❌ Could not create modmail thread. Make sure I have **Create Public Threads** permission!', ephemeral: true });
    }
  }

  // ── Modmail Cancel ────────────────────────────────────────────────
  if (interaction.customId === 'modmail_cancel') {
    modmailPending.delete(interaction.user.id);
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle('☁️ No problem!')
        .setDescription(`no modmail ticket was opened. if you need help later, just DM me again! 🌸`)
        .setColor(C_MAIN)
        .setFooter({ text: "Luna's Shop ☁️" })],
      components: []
    });
  }

  // ── Open Ticket ───────────────────────────────────────────────────
  if (interaction.customId === 'ticket_open') {
    try {
      const num = nextTicketNum(interaction.user.id);
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'user';
      const staffRole = interaction.guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageGuild) && !r.managed);
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${safeName}-${num}`,
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
          .setTitle('🎫 Ticket Opened')
          .setDescription(
            `⬚　﹑　 　　hey ${interaction.user}! welcome to your ticket\n` +
            `　﹒　┆﹒　please describe your issue in detail\n\n` +
            `　𐂯　﹑　　　our staff will be with you shortly　　꒰っ.､꒱\n\n` +
            `　z☡z　﹑　 　　use \`!closeticket\` to close this ticket`
          )
          .setColor(C_MAIN)
          .setFooter({ text: "Luna's Shop ☁️" })]
      });
      await interaction.reply({ content: `✅ Your ticket has been created! ${ticketChannel}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not create ticket. Make sure I have **Manage Channels** permission!', ephemeral: true });
    }
  }

  // ── Verify ───────────────────────────────────────────────────────────
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
        .setFooter({ text: "Luna's Shop ☁️ • type your answer below" })] });
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
          .setFooter({ text: "Luna's Shop ☁️" })]
      });
      await interaction.reply({ content: `✅ Your order ticket has been created! ${ticketChannel}`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Could not create ticket. Make sure I have **Manage Channels** permission!', ephemeral: true });
    }
  }

  // ── Accept / Deny Application ─────────────────────────────────────
  if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_deny_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return interaction.reply({ content: '❌ You need **Manage Server** permission.', ephemeral: true });

    const accepted = interaction.customId.startsWith('app_accept_');
    const appData = pendingApplications.get(interaction.message.id);
    if (!appData) return interaction.reply({ content: '❌ Application data not found.', ephemeral: true });

    pendingApplications.delete(interaction.message.id);

    // Update the embed in apps channel
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(accepted ? 0x57F287 : 0xFF6B6B)
      .setFooter({ text: `${accepted ? '✅ Accepted' : '❌ Denied'} by ${interaction.user.tag}` });

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('app_accept_done').setLabel('✅ Accepted').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('app_deny_done').setLabel('❌ Denied').setStyle(ButtonStyle.Danger).setDisabled(true)
    );

    await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });

    // DM the applicant
    try {
      const user = await client.users.fetch(appData.userId);
      await user.send({ embeds: [new EmbedBuilder()
        .setTitle(accepted ? '✅ Application Accepted!' : '❌ Application Denied')
        .setDescription(accepted
          ? `hey **${appData.tag}**! 🎉☁️\n\nyour **${appData.type === 'staff' ? 'staff' : 'GFX artist'}** application at **Luna's Cafe** has been **accepted**!\n\nwelcome to the team! please check the server for further instructions. 🌸`
          : `hey **${appData.tag}**! ☁️\n\nthank you for applying to **Luna's Cafe**.\nunfortunately your **${appData.type === 'staff' ? 'staff' : 'GFX artist'}** application was **not accepted** at this time.\n\ndon't be discouraged — you're always welcome to apply again in the future! 🌸`
        )
        .setColor(accepted ? C_SUCCESS : C_ERROR)
        .setFooter({ text: "Luna's Shop ☁️" })] });
    } catch { /* User has DMs closed */ }

    await interaction.reply({ content: `${accepted ? '✅ Accepted' : '❌ Denied'} **${appData.tag}**'s application and DM'd them the result!`, ephemeral: true });
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
      .setFooter({ text: "Luna's Shop ☁️ • Good luck!" })] });
    await interaction.reply({ content: '🎉 You\'ve entered the giveaway! Good luck! 🍀', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
