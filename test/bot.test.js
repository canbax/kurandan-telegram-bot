const test = require("node:test");
const assert = require("node:assert/strict");
const { createBot, parseTelegramUpdate } = require("../src/bot");
const { WELCOME_MESSAGE } = require("../src/config");

function fakeBot() {
  const sent = [];
  const bot = createBot({
    telegram: { sendMessage: async (text, chatId) => sent.push({ text, chatId }) },
    getPassage: async () => "rastgele pasaj",
  });
  return { bot, sent };
}

test("/pasaj replies with a passage", async () => {
  const { bot, sent } = fakeBot();

  assert.equal(await bot.handleCommand("/pasaj", 7), true);
  assert.deepEqual(sent, [{ text: "rastgele pasaj", chatId: 7 }]);
});

test("/start replies with the welcome message", async () => {
  const { bot, sent } = fakeBot();

  assert.equal(await bot.handleCommand("/start", 7), true);
  assert.deepEqual(sent, [{ text: WELCOME_MESSAGE, chatId: 7 }]);
});

test("unknown messages are ignored", async () => {
  const { bot, sent } = fakeBot();

  assert.equal(await bot.handleCommand("merhaba", 7), false);
  assert.deepEqual(sent, []);
});

test("parseTelegramUpdate extracts the text and chat id", () => {
  assert.deepEqual(
    parseTelegramUpdate({ message: { text: "/pasaj", chat: { id: 9 } } }),
    { text: "/pasaj", chatId: 9 }
  );
});

test("parseTelegramUpdate returns null for updates without a text message", () => {
  assert.equal(parseTelegramUpdate(undefined), null);
  assert.equal(parseTelegramUpdate({}), null);
  assert.equal(parseTelegramUpdate({ message: { chat: { id: 1 } } }), null);
  assert.equal(parseTelegramUpdate({ message: { text: "hi" } }), null);
});
