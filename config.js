require('dotenv').config(); // Load .env file

module.exports = {
  // These values are now loaded from the .env file for local development,
  // or from Render's environment variables in production.
  token: process.env.BOT_TOKEN,
  guildId: process.env.GUILD_ID,

  // صورة لوحة التذاكر الرئيسية
  panelImage: "https://k.top4top.io/p_3545aww541.jpg",//صورة اللي تيجي في التيكت

  // الصور المخصصة داخل كل تذكرة
  ticketImages: {
    support: "https://k.top4top.io/p_3545aww541.jpg",//صورة اللي تيجي في الدعم الفني
    bug: "https://k.top4top.io/p_3545aww541.jpg",//صورة اللي تيجي في الابلاغ عن مشاكل
    admin: "https://k.top4top.io/p_3545aww541.jpg",//صورة اللي تيجي في التقديم على الادارة
  },
};
