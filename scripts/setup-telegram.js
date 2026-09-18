#!/usr/bin/env node
// Registers the webhook and the bot's command list with Telegram.
//
// Run it after a deploy, after changing WEBHOOK_URL or BOT_COMMANDS, and after
// touching the bot from BotFather -- BotFather's command editor writes to the
// same place `setMyCommands` does, so whichever ran last is what users see.
//
//   TELEGRAM_BOT_TOKEN=... npm run setup:telegram
const { readConfig, BOT_COMMANDS, WEBHOOK_URL } = require("../src/config");
const { createTelegramClient } = require("../src/telegram");

async function main() {
  const config = readConfig(process.env);
  const telegram = createTelegramClient({ token: config.telegramBotToken });

  const info = await telegram.getBotInfo();
  console.log("bot:", "@" + info.result.username);

  const previous = await telegram.getWebhookUrl();
  const changed = await telegram.ensureWebhook();
  console.log(
    changed
      ? `webhook: ${previous || "(none)"} -> ${WEBHOOK_URL}`
      : `webhook: already ${WEBHOOK_URL}`
  );

  await telegram.setCommands();
  console.log(
    "commands:",
    BOT_COMMANDS.map((c) => "/" + c.command).join(", ")
  );
}

main().catch((err) => {
  console.error("setup failed:", err.message || err);
  process.exit(1);
});
