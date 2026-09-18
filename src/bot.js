const { WELCOME_MESSAGE } = require("./config");

/**
 * The bot's command handling, kept free of Express and of HTTP clients.
 */

/**
 * Pulls the bits we care about out of a Telegram update payload.
 * @param {object | undefined} update
 * @returns {{ text: string, chatId: number } | null} null for updates that
 *   carry no text message (photos, edits, channel joins, ...).
 */
function parseTelegramUpdate(update) {
  const message = update && update.message;
  if (!message || typeof message.text !== "string" || !message.chat) {
    return null;
  }
  return { text: message.text, chatId: message.chat.id };
}

/**
 * @param {object} deps
 * @param {{ sendMessage: (text: string, chatId: number) => Promise<unknown> }} deps.telegram
 * @param {() => Promise<string>} deps.getPassage
 */
function createBot({ telegram, getPassage }) {
  /**
   * @param {string} text the raw message the user sent
   * @param {number | string} chatId
   * @returns {Promise<boolean>} whether the message was a known command.
   */
  async function handleCommand(text, chatId) {
    if (text === "/pasaj") {
      await telegram.sendMessage(await getPassage(), chatId);
      return true;
    }
    if (text === "/start") {
      await telegram.sendMessage(WELCOME_MESSAGE, chatId);
      return true;
    }
    return false;
  }

  return { handleCommand };
}

module.exports = { createBot, parseTelegramUpdate };
