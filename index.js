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

  // ── !help ────────────────────────────────────────────────────────
  if (command === '!help') {
    const embed = new EmbedBuilder()
      .setTitle('☕ Luna\'s Cafe — Commands')
      .setDescription(
        `**Setup**\n` +
        `\`!rules\` — Post the rules\n` +
        `\`!setup\` — Post verification panel\n\n` +
        `**GFX**\n` +
        `\`!status <commissions> <requests>\` — Update GFX status\n` +
        `Options: \`open\`, \`close\`, \`limited\`\n\n` +
        `**Moderation**\n` +
        `\`!kick @user reason\` — Kick a member\n` +
        `\`!ban @user reason\` — Ban a member\n` +
        `\`!unban <userID>\` — Unban a member\n` +
        `\`!timeout @user <mins> reason\` — Timeout\n` +
        `\`!untimeout @user\` — Remove timeout\n` +
        `\`!warn @user reason\` — Warn a member\n` +
        `\`!purge <1-100>\` — Delete messages\n`
      )
      .setColor(0xF2C4CE)
      .setFooter({ text: 'Luna\'s Cafe ☕' });

    message.reply({ embeds: [embed] });
  }
});

// ─── BUTTON INTERACTION ─────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'verify') return;

  try {
    await interaction.member.roles.add(VERIFIED_ROLE_ID);
    await interaction.reply({
      content: '☕ Welcome to Luna\'s Cafe! Enjoy your stay ʚɞ',
      ephemeral: true
    });
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: '❌ Something went wrong. Please contact an admin.',
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
