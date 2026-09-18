const test = require("node:test");
const assert = require("node:assert/strict");
const { createTelegramClient } = require("../src/telegram");
const { WEBHOOK_URL } = require("../src/config");

function fakeClient(getResponses = {}) {
  const posts = [];
  const gets = [];
  const telegram = createTelegramClient({
    token: "TOKEN",
    getJson: async (url) => {
      gets.push(url);
      const key = Object.keys(getResponses).find((k) => url.includes(k));
      return key ? getResponses[key] : {};
    },
    postJson: async (url, json) => {
      posts.push({ url, json });
      return { ok: true };
    },
  });
  return { telegram, gets, posts };
}

test("sendMessage posts to the bot's sendMessage endpoint", async () => {
  const { telegram, posts } = fakeClient();

  await telegram.sendMessage("selam", 42);

  assert.deepEqual(posts, [
    {
      url: "https://api.telegram.org/botTOKEN/sendMessage",
      json: { chat_id: 42, text: "selam" },
    },
  ]);
});

test("hasWebhook is false when Telegram reports an empty url", async () => {
  const { telegram } = fakeClient({ getWebhookInfo: { result: { url: "" } } });
  assert.equal(await telegram.hasWebhook(), false);
});

test("ensureWebhook registers the webhook when none is set", async () => {
  const { telegram, gets } = fakeClient({
    getWebhookInfo: { result: { url: "" } },
  });

  assert.equal(await telegram.ensureWebhook("https://bot.test/hook"), true);
  assert.ok(
    gets.some((url) => url.endsWith("setWebhook?url=https://bot.test/hook")),
    `setWebhook was not called: ${gets.join(", ")}`
  );
});

test("ensureWebhook leaves the webhook alone when it already matches", async () => {
  const { telegram, gets } = fakeClient({
    getWebhookInfo: { result: { url: WEBHOOK_URL } },
  });

  assert.equal(await telegram.ensureWebhook(), false);
  assert.ok(!gets.some((url) => url.includes("setWebhook")));
});

test("ensureWebhook replaces a webhook pointing somewhere else", async () => {
  const { telegram, gets } = fakeClient({
    getWebhookInfo: { result: { url: "https://stale.test/hook" } },
  });

  assert.equal(await telegram.ensureWebhook("https://bot.test/hook"), true);
  assert.ok(
    gets.some((url) => url.endsWith("setWebhook?url=https://bot.test/hook")),
    `setWebhook was not called: ${gets.join(", ")}`
  );
});

test("setCommands publishes the /pasaj command by default", async () => {
  const { telegram, posts } = fakeClient();

  await telegram.setCommands();

  assert.equal(posts[0].url, "https://api.telegram.org/botTOKEN/setMyCommands");
  assert.deepEqual(posts[0].json.commands, [
    { command: "pasaj", description: "Rastgele pasaj getirir" },
  ]);
});
