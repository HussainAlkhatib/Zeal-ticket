const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

// Path to the configurations file
const configsPath = path.join(__dirname, '..', 'configurations.json');

// Helper function to read configs
async function readConfigs() {
    try {
        const data = await fs.readFile(configsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // Return empty object if file doesn't exist
        }
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد أو تحديث نظام التذاكر')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('panel_channel')
                .setDescription('القناة التي سيتم إرسال لوحة التحكم بها')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        // Optional options for each ticket type
        .addChannelOption(option =>
            option.setName('support_category')
                .setDescription('فئة تذاكر الدعم الفني')
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('رتبة فريق الدعم الفني'))
        .addChannelOption(option =>
            option.setName('bug_category')
                .setDescription('فئة تذاكر الإبلاغ عن المشاكل')
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('bug_role')
                .setDescription('رتبة فريق مراجعة المشاكل'))
        .addChannelOption(option =>
            option.setName('admin_category')
                .setDescription('فئة تذاكر التقديم على الإدارة')
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('admin_role')
                .setDescription('رتبة الموارد البشرية (لمراجعة التقديمات)')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { guild, options } = interaction;

        const panelChannelInput = options.getChannel('panel_channel');
        if (!panelChannelInput) {
            return interaction.editReply({ content: '❌ لم يتم العثور على القناة المحددة للوحة التحكم. يرجى التأكد من أن البوت يمتلك صلاحية رؤيتها.' });
        }

        // 1. Load existing configurations
        const allConfigs = await readConfigs();
        const guildConfig = allConfigs[guild.id] || {
            panelChannel: null,
            categories: {},
            roles: {},
        };

        // 2. Update panel channel
        guildConfig.panelChannel = panelChannelInput.id;

        // 3. Update ticket types if provided
        const ticketTypes = ['support', 'bug', 'admin'];

        for (const type of ticketTypes) {
            const category = options.getChannel(`${type}_category`);
            const role = options.getRole(`${type}_role`);

            // User must provide both category and role to set up a type
            if (category && role) {
                guildConfig.categories[type] = category.id;
                guildConfig.roles[type] = [role.id];
            }
        }

        // 4. Save the merged configuration
        allConfigs[guild.id] = guildConfig;
        await fs.writeFile(configsPath, JSON.stringify(allConfigs, null, 4));

        // 5. Build the dynamic ticket panel
        const staticConfig = require('../config.js'); // For images
        const panelEmbed = new EmbedBuilder()
            .setTitle("نظام التذاكر")
            .setDescription("**اختر نوع التذكرة من القائمة أدناه**")
            .setColor("Blue")
            .setImage(staticConfig.panelImage);

        const menuOptions = [
            { label: "دعم فني", value: "ticket_support", type: "support" },
            { label: "إبلاغ عن مشكلة", value: "ticket_bug", type: "bug" },
            { label: "تقديم إدارة", value: "ticket_admin", type: "admin" },
        ];

        const availableOptions = menuOptions.filter(option => guildConfig.categories[option.type]);

        if (availableOptions.length === 0) {
            await interaction.editReply({ content: '✅ تم حفظ الإعدادات، ولكن لم يتم إعداد أي نوع من أنواع التذاكر بعد. أرسل لوحة التحكم لاحقاً عند إضافة نوع تذكرة واحد على الأقل.' });
            return;
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_menu")
            .setPlaceholder("اختر نوع التذكرة")
            .addOptions(availableOptions.map(({label, value}) => ({label, value})));

        const row = new ActionRowBuilder().addComponents(menu);
        const panelChannel = guild.channels.cache.get(guildConfig.panelChannel);

        if (panelChannel) {
            await panelChannel.send({ embeds: [panelEmbed], components: [row] });
            await interaction.editReply({ content: `✅ تم تحديث الإعدادات وإرسال لوحة التحكم إلى ${panelChannel}.` });
        } else {
            await interaction.editReply({ content: '❌ تم حفظ الإعدادات، ولكن لم أتمكن من العثور على قناة لوحة التحكم لإرسال الرسالة.' });
        }
    },
};

