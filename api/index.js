// Vercel entry point. All of the logic lives in ../src; this file only wires it
// up, starts the server and hands the Express app to the platform.
const { createBotApp, startServer } = require("../src");

const botApp = createBotApp();

startServer(botApp).catch((err) => console.error("startup failed:", err));

module.exports = botApp.app;
