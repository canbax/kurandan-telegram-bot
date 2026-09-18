// Vercel entry point. All of the logic lives in ../src; this file only wires it
// up and hands the Express app to the platform.
//
// Nothing is registered with Telegram from here. On Vercel this module is a
// serverless function: `app.listen` is ignored, the module body only runs on a
// cold start, and any promise still pending when the response goes out is
// frozen with the instance -- so a fire-and-forget setup call is simply lost.
// `npm run setup:telegram` does that registration instead, once, from a
// machine that stays alive until the API answers.
const { createBotApp, startServer } = require("../src");

const botApp = createBotApp();

// `npm start` runs this file directly; there a real long-lived server, and the
// webhook/command registration that goes with it, is what we want.
if (require.main === module) {
  startServer(botApp).catch((err) => console.error("startup failed:", err));
}

module.exports = botApp.app;
