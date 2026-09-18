/**
 * Every constant and environment lookup lives here, so the rest of the code
 * can be handed plain values instead of reaching into `process.env` itself.
 * That is what makes the other modules testable without any env setup.
 */

/**
 * How long a passage may get before `buildPassage` truncates it. This is an
 * editorial choice about readable post length, not a platform limit --
 * Telegram itself accepts messages up to 4096 characters.
 */
const CHAR_LIMIT = 1024;

const WELCOME_MESSAGE =
  "Merhaba. Ben Kur'an'dan pasajlar getiren bir botum :) /pasaj komutu ile rastgele pasaj getirebilirsiniz.";

const TELEGRAM_CHANNEL = "@kurandanmesaj";

const WEBHOOK_URL = "https://kurandan.vercel.app/api/tupdate";

const BOT_COMMANDS = [
  { command: "pasaj", description: "Rastgele pasaj getirir" },
];

/**
 * Reads the configuration out of an environment-like object.
 * @param {Record<string, string | undefined>} env
 * @throws {Error} when a required variable is missing.
 */
function readConfig(env = process.env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("'TELEGRAM_BOT_TOKEN' should be an environment variable");
  }

  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    twitter: {
      consumerKey: env.TWITTER_CONSUMER_KEY,
      consumerSecret: env.TWITTER_CONSUMER_SECRET,
      accessToken: env.TWITTER_OAUTH_TOKEN,
      accessTokenSecret: env.TWITTER_TOKEN_SECRET,
    },
    port: Number(env.PORT) || 3000,
  };
}

module.exports = {
  BOT_COMMANDS,
  CHAR_LIMIT,
  TELEGRAM_CHANNEL,
  WEBHOOK_URL,
  WELCOME_MESSAGE,
  readConfig,
};
