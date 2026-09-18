const express = require("express");
const path = require("path");
const { TELEGRAM_CHANNEL } = require("./config");
const { parseTelegramUpdate } = require("./bot");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * Builds the Express app. Every collaborator is injected, so a test can start
 * the app with fake clients and drive it over real HTTP.
 *
 * @param {object} deps
 * @param {{ handleCommand: (text: string, chatId: number) => Promise<boolean> }} deps.bot
 * @param {{ sendMessage: (text: string, chatId: string) => Promise<unknown> }} deps.telegram
 * @param {{ sendTweet: (text: string) => Promise<unknown> }} deps.twitter
 * @param {() => Promise<string>} deps.getPassage
 * @param {string} deps.dailySecret shared secret the daily trigger must send
 * @param {Console} [deps.logger]
 */
function createApp({
  bot,
  telegram,
  twitter,
  getPassage,
  dailySecret,
  logger = console,
}) {
  const app = express();

  // Allow every browser to read responses from this server.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // Telegram pushes user messages here via its webhook.
  app.post("/api/tupdate", async (req, res, next) => {
    try {
      const update = parseTelegramUpdate(req.body);
      if (!update) {
        res.json({ ok: true, handled: false, reason: "no text message" });
        return;
      }
      logger.log("telegram update came with message:", update.text);
      const handled = await bot.handleCommand(update.text, update.chatId);
      res.json({ ok: true, handled });
    } catch (err) {
      next(err);
    }
  });

  // A scheduled GitLab pipeline calls this once a day.
  app.post("/api/daily", async (req, res, next) => {
    try {
      if (!req.body || req.body.pwd !== dailySecret) {
        res.status(401).json({ ok: false, error: "need password!" });
        return;
      }
      const passage = await getPassage();
      await telegram.sendMessage(passage, TELEGRAM_CHANNEL);
      await twitter.sendTweet(passage);
      res.json({ ok: true, passage });
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars -- Express needs the 4th argument
  app.use((err, req, res, next) => {
    logger.error("request failed:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  });

  return app;
}

module.exports = { createApp };
