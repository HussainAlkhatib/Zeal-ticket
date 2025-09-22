const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

// Path to the configurations file
const configsPath = path.join(__dirname, '..', 'configurations.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('إعداد نظام التذاكر بشكل كامل')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('panel_channel')
                .setDescription('القناة التي سيتم إرسال لوحة التحكم بها')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addChannelOption(option =>
            option.setName('support_category')
                .setDescription('فئة تذاكر الدعم الفني')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('رتبة فريق الدعم الفني')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('bug_category')
                .setDescription('فئة تذاكر الإبلاغ عن المشاكل')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('bug_role')
                .setDescription('رتبة فريق مراجعة المشاكل')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('admin_category')
                .setDescription('فئة تذاكر التقديم على الإدارة')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(option =>
            option.setName('admin_role')
                .setDescription('رتبة الموارد البشرية (لمراجعة التقديمات)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { guild } = interaction;

        // 1. استخراج الخيارات من الأمر
        const config = {
            panelChannel: interaction.options.getChannel('panel_channel').id,
            categories: {
                support: interaction.options.getChannel('support_category').id,
                bug: interaction.options.getChannel('bug_category').id,
                admin: interaction.options.getChannel('admin_category').id,
            },
            roles: {
                support: [interaction.options.getRole('support_role').id],
                bug: [interaction.options.getRole('bug_role').id],
                admin: [interaction.options.getRole('admin_role').id],
            }
        };

        // 2. حفظ الإعدادات في ملف
        let allConfigs = {};
        try {
            const data = await fs.readFile(configsPath, 'utf8');
            allConfigs = JSON.parse(data);
        } catch (error) {
            // File might not exist yet, which is fine
            if (error.code !== 'ENOENT') throw error;
        }

        allConfigs[guild.id] = config;
        await fs.writeFile(configsPath, JSON.stringify(allConfigs, null, 4));

        // 3. إرسال رسالة التأكيد
        await interaction.editReply({ content: '✅ تم حفظ إعدادات نظام التذاكر بنجاح.' });

        // 4. إرسال لوحة التحكم (نفس لوحة التحكم القديمة)
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        const staticConfig = require('../config.js'); // For images

        const panelEmbed = new EmbedBuilder()
            .setTitle("نظام التذاكر")
            .setDescription("**اختر نوع التذكرة من القائمة أدناه**")
            .setColor("Blue")
            .setImage(staticConfig.panelImage);

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_menu")
            .setPlaceholder("اختر نوع التذكرة")
            .addOptions([
                { label: "دعم فني", value: "ticket_support" },
                { label: "إبلاغ عن مشكلة", value: "ticket_bug" },
                { label: "تقديم إدارة", value: "ticket_admin" },
            ]);

        const row = new ActionRowBuilder().addComponents(menu);
        
        const panelChannel = guild.channels.cache.get(config.panelChannel);
        if (panelChannel) {
            await panelChannel.send({ embeds: [panelEmbed], components: [row] });
        } else {
            await interaction.followUp({ content: '❌ لم أتمكن من العثور على قناة لوحة التحكم لإرسال الرسالة.', ephemeral: true });
        }
    },
};
