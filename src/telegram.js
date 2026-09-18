const got = require("got");
const { BOT_COMMANDS, WEBHOOK_URL } = require("./config");

/**
 * Thin wrapper over the Telegram Bot API. The HTTP calls are injected so tests
 * can assert on the requests without touching the network.
 */

/**
 * @param {object} args
 * @param {string} args.token bot token
 * @param {(url: string) => Promise<unknown>} [args.getJson]
 * @param {(url: string, json: object) => Promise<unknown>} [args.postJson]
 */
function createTelegramClient({
  token,
  getJson = defaultGetJson,
  postJson = defaultPostJson,
}) {
  const baseUrl = `https://api.telegram.org/bot${token}/`;

  /**
   * @param {string} text
   * @param {string | number} chatId channel handle or numeric chat id
   */
  async function sendMessage(text, chatId) {
    return postJson(baseUrl + "sendMessage", { chat_id: chatId, text });
  }

  async function getBotInfo() {
    return getJson(baseUrl + "getMe");
  }

  async function hasWebhook() {
    const payload = await getJson(baseUrl + "getWebhookInfo");
    return Boolean(payload.result.url);
  }

  /** Registers the webhook unless one is already registered. */
  async function ensureWebhook(url = WEBHOOK_URL) {
    if (await hasWebhook()) {
      return false;
    }
    await getJson(baseUrl + "setWebhook?url=" + url);
    return true;
  }

  async function setCommands(commands = BOT_COMMANDS) {
    return postJson(baseUrl + "setMyCommands", { commands });
  }

  return { ensureWebhook, getBotInfo, hasWebhook, sendMessage, setCommands };
}

async function defaultGetJson(url) {
  const { body } = await got(url);
  return JSON.parse(body);
}

async function defaultPostJson(url, json) {
  const { body } = await got.post(url, { json });
  return body;
}

module.exports = { createTelegramClient };
