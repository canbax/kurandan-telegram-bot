const test = require("node:test");
const assert = require("node:assert/strict");
const { readConfig } = require("../src/config");

test("readConfig throws when the bot token is missing", () => {
  assert.throws(() => readConfig({}), /TELEGRAM_BOT_TOKEN/);
});

test("readConfig collects the tokens and defaults the port", () => {
  const config = readConfig({
    TELEGRAM_BOT_TOKEN: "t",
    TWITTER_CONSUMER_KEY: "ck",
    TWITTER_CONSUMER_SECRET: "cs",
    TWITTER_OAUTH_TOKEN: "at",
    TWITTER_TOKEN_SECRET: "ats",
  });

  assert.equal(config.telegramBotToken, "t");
  assert.equal(config.port, 3000);
  assert.deepEqual(config.twitter, {
    consumerKey: "ck",
    consumerSecret: "cs",
    accessToken: "at",
    accessTokenSecret: "ats",
  });
});

test("readConfig honours PORT", () => {
  assert.equal(readConfig({ TELEGRAM_BOT_TOKEN: "t", PORT: "8080" }).port, 8080);
});
