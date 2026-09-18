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

  /** @returns {Promise<string>} the registered url, "" when there is none. */
  async function getWebhookUrl() {
    const payload = await getJson(baseUrl + "getWebhookInfo");
    return (payload.result && payload.result.url) || "";
  }

  async function hasWebhook() {
    return Boolean(await getWebhookUrl());
  }

  /**
   * Points the webhook at `url`. A webhook registered for some *other* url --
   * a previous deploy, or one set by hand -- is replaced, because "some
   * webhook exists" is not the same as "our webhook exists"; only skipping the
   * call when the urls already match keeps this a no-op in the common case.
   *
   * @returns {Promise<boolean>} whether the webhook had to be (re)registered.
   */
  async function ensureWebhook(url = WEBHOOK_URL) {
    if ((await getWebhookUrl()) === url) {
      return false;
    }
    await getJson(baseUrl + "setWebhook?url=" + url);
    return true;
  }

  async function setCommands(commands = BOT_COMMANDS) {
    return postJson(baseUrl + "setMyCommands", { commands });
  }

  return {
    ensureWebhook,
    getBotInfo,
    getWebhookUrl,
    hasWebhook,
    sendMessage,
    setCommands,
  };
}

async function defaultGetJson(url) {
  try {
    const { body } = await got(url);
    return JSON.parse(body);
  } catch (err) {
    throw describeApiError(err, url);
  }
}

async function defaultPostJson(url, json) {
  try {
    const { body } = await got.post(url, { json });
    return body;
  } catch (err) {
    throw describeApiError(err, url, json);
  }
}

/**
 * Telegram explains every rejection in the response body; got only reports the
 * status code. Without this, a 400 reaches the logs as "Response code 400 (Bad
 * Request)" and says nothing about what was actually wrong with the request.
 *
 * @param {Error & { response?: { body?: unknown } }} err
 * @param {string} url the API url, whose last segment is the method name
 * @param {object} [json] the request payload, minus its `text`
 */
function describeApiError(err, url, json) {
  const payload = err.response && err.response.body;
  if (payload === undefined) {
    return err;
  }

  let description = payload;
  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    description = parsed.description || JSON.stringify(parsed);
  } catch (parseErr) {
    // A non-JSON body is still worth logging verbatim.
  }

  const method = url.split("/").pop();
  // The passage itself is noise in a log line, but its length is not.
  const context = json
    ? ` (chat_id=${json.chat_id}, text length=${(json.text || "").length})`
    : "";

  const wrapped = new Error(`telegram ${method} failed: ${description}${context}`);
  wrapped.cause = err;
  return wrapped;
}

module.exports = { createTelegramClient };
