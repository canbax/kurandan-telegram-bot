const { createAcikKuranClient } = require("./acikkuran");
const { createApp } = require("./app");
const { createBot } = require("./bot");
const { readConfig } = require("./config");
const { getRandomPassage } = require("./passage");
const { createTelegramClient } = require("./telegram");
const { createTwitterClient } = require("./twitter");

/**
 * Composition root: the single place where the real clients are constructed
 * and wired together. Everything below it only ever sees its dependencies.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ app: import("express").Express, config: object, telegram: object }}
 */
function createBotApp(env = process.env) {
  const config = readConfig(env);

  const quran = createAcikKuranClient();
  const telegram = createTelegramClient({ token: config.telegramBotToken });
  const twitter = createTwitterClient(config.twitter);
  const getPassage = () => getRandomPassage({ fetchVerse: quran.fetchVerse });
  const bot = createBot({ telegram, getPassage });

  const app = createApp({
    bot,
    telegram,
    twitter,
    getPassage,
    // The daily trigger authenticates with the bot token itself.
    dailySecret: config.telegramBotToken,
  });

  return { app, config, telegram };
}

/**
 * Starts the HTTP server and makes sure Telegram knows about the webhook and
 * the bot's command list.
 *
 * @param {ReturnType<typeof createBotApp>} botApp
 */
async function startServer({ app, config, telegram }) {
  app.listen(config.port, () => console.log("server on " + config.port));

  await telegram.ensureWebhook();
  await telegram.setCommands();
}

module.exports = { createBotApp, startServer };
