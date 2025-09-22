const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('by')
		.setDescription('يعرض معلومات عن البوت وحقوق الملكية'),
	async execute(interaction) {
		const byEmbed = new EmbedBuilder()
			.setColor('Blue')
			.setTitle('بوت نظام التذاكر')
			.setDescription('بوت متخصص في إدارة تذاكر الدعم الفني والإبلاغات والتقديمات.')
			.setFooter({ text: 'By Hussain | All rights reserved for Zeal Server' });

		await interaction.reply({ embeds: [byEmbed] });
	},
};
