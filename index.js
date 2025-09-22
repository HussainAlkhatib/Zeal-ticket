require("dotenv").config();
const express = require("express");
const fs = require('fs/promises');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require("discord.js");

// =======================
// Express
// =======================
const app = express();
app.get("/", (req, res) => res.send("ready"));
app.listen(3000, () => console.log("✅ Express جاهز"));

// =======================
// إعداد البوت
// =======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// =======================
// تحميل الأوامر
// =======================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
// Use fs.readdirSync as it's synchronous and only done once at startup.
const commandFiles = require('fs').readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// =======================
// تخزين أصحاب التذاكر
// =======================
const ticketOwners = new Map();

// =======================
// عند تشغيل البوت
// =======================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("Zeal Server");
});

// =======================
// التعامل مع التفاعلات
// =======================
client.on("interactionCreate", async (interaction) => {
  // =================== أوامر السلاش ===================
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
    return;
  }

  const { guild, member } = interaction;

  // =================== قائمة التذاكر ===================
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
    await interaction.deferReply({ ephemeral: true });

    // --- تحميل الإعدادات الديناميكية ---
    const configsPath = path.join(__dirname, 'configurations.json');
    let guildConfig;
    try {
        const data = await fs.readFile(configsPath, 'utf8');
        const allConfigs = JSON.parse(data);
        guildConfig = allConfigs[guild.id];
    } catch (error) {
        // File might not exist or be empty
    }

    if (!guildConfig) {
        return interaction.editReply({ content: '❌ لم يتم إعداد نظام التذاكر لهذا السيرفر. يرجى مطالبة مسؤول بتشغيل أمر `/setup` أولاً.' });
    }
    // --- نهاية تحميل الإعدادات ---

    const staticConfig = require("./config.js"); // For images
    let ticketName = `ticket-${member.user.username}`;
    let allowedRoles = [];
    let categoryId = null;
    let ticketImage = null;

    const selection = interaction.values[0];
    const type = selection.replace('ticket_', ''); // e.g., 'support', 'bug', 'admin'

    if (guildConfig.categories[type] && guildConfig.roles[type]) {
        ticketName = `${type}-${member.user.username}`;
        allowedRoles = guildConfig.roles[type];
        categoryId = guildConfig.categories[type];
        ticketImage = staticConfig.ticketImages[type];
    } else {
        return interaction.editReply({ content: "❌ نوع التذكرة غير صحيح أو غير مُعد.", ephemeral: true });
    }

    const category = guild.channels.cache.get(categoryId);
    if (!category) return interaction.editReply({ content: "❌ الفئة (Category) المحددة في الإعدادات غير موجودة.", ephemeral: true });

    const validRoles = allowedRoles.map(id => guild.roles.cache.get(id)).filter(r => r);

    const channel = await guild.channels.create({
      name: ticketName,
      type: 0, // Text channel
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ...validRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("تم فتح تذكرتك")
      .setDescription("انتظر حتى يرد عليك الفريق المختص")
      .setColor("Green")
      .setImage(ticketImage);

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("accept_ticket").setLabel("استلام").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("leave_ticket").setLabel("ترك").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close_ticket").setLabel("إغلاق").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `${member}`, embeds: [embed], components: [controlRow] });
    return interaction.editReply({ content: `✅ تم فتح تذكرتك: ${channel}` });
  }

  // ========== Buttons ==========
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "accept_ticket") {
      if (ticketOwners.has(interaction.channel.id)) {
        return interaction.reply({ content: `❌ التذكرة مستلمة بالفعل بواسطة <@${ticketOwners.get(interaction.channel.id)}>`, ephemeral: true });
      }
      ticketOwners.set(interaction.channel.id, member.user.id);
      await interaction.channel.send(`📩 تم استلام التذكرة بواسطة <@${member.user.id}>`);
      return interaction.deferUpdate();
    }

    if (id === "leave_ticket") {
      if (ticketOwners.get(interaction.channel.id) !== member.user.id) {
        return interaction.reply({ content: "❌ أنت لست الشخص الذي استلم هذه التذكرة", ephemeral: true });
      }
      ticketOwners.delete(interaction.channel.id);
      await interaction.channel.send(`✋ <@${member.user.id}> ترك التذكرة، يمكن لأي شخص آخر استلامها الآن`);
      return interaction.deferUpdate();
    }

    if (id === "close_ticket") {
      await interaction.reply({ content: "🔒 سيتم إغلاق التذكرة بعد 5 ثواني...", ephemeral: true });
      setTimeout(async () => {
        try {
          if (interaction.channel && interaction.channel.deletable) await interaction.channel.delete();
          ticketOwners.delete(interaction.channel?.id);
        } catch (err) {
          console.error("❌ ما قدر يحذف التذكرة:", err);
        }
      }, 5000);
    }
  }
});

// =======================
// تسجيل الدخول
// =======================
const config = require("./config.js");
client.login(config.token);
