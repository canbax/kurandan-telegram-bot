const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const silentLogger = { log() {}, error() {} };

/** Boots the app on an ephemeral port and returns a `post` helper. */
async function withApp(deps, run) {
  const app = createApp({ logger: silentLogger, dailySecret: "s3cret", ...deps });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const post = (path, body) =>
    fetch(baseUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    await run({ post, baseUrl });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function spies({ passage = "pasaj" } = {}) {
  const calls = { handled: [], messages: [], tweets: [] };
  return {
    calls,
    bot: {
      handleCommand: async (text, chatId) => {
        calls.handled.push({ text, chatId });
        return text.startsWith("/");
      },
    },
    telegram: {
      sendMessage: async (text, chatId) => calls.messages.push({ text, chatId }),
    },
    twitter: { sendTweet: async (text) => calls.tweets.push(text) },
    getPassage: async () => passage,
  };
}

test("POST /api/tupdate hands the message to the bot", async () => {
  const deps = spies();
  await withApp(deps, async ({ post }) => {
    const res = await post("/api/tupdate", {
      message: { text: "/pasaj", chat: { id: 5 } },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, handled: true });
    assert.deepEqual(deps.calls.handled, [{ text: "/pasaj", chatId: 5 }]);
  });
});

test("POST /api/tupdate tolerates updates that carry no text", async () => {
  const deps = spies();
  await withApp(deps, async ({ post }) => {
    const res = await post("/api/tupdate", { message: { chat: { id: 5 } } });

    assert.equal(res.status, 200);
    assert.equal((await res.json()).handled, false);
    assert.deepEqual(deps.calls.handled, []);
  });
});

test("POST /api/daily publishes the passage to Telegram and Twitter", async () => {
  const deps = spies({ passage: "gunun pasaji" });
  await withApp(deps, async ({ post }) => {
    const res = await post("/api/daily", { pwd: "s3cret" });

    assert.equal(res.status, 200);
    assert.deepEqual(deps.calls.messages, [
      { text: "gunun pasaji", chatId: "@kurandanmesaj" },
    ]);
    assert.deepEqual(deps.calls.tweets, ["gunun pasaji"]);
  });
});

test("POST /api/daily rejects a wrong or missing password", async () => {
  const deps = spies();
  await withApp(deps, async ({ post }) => {
    for (const body of [{}, { pwd: "wrong" }]) {
      const res = await post("/api/daily", body);
      assert.equal(res.status, 401);
    }
    assert.deepEqual(deps.calls.messages, []);
    assert.deepEqual(deps.calls.tweets, []);
  });
});

test("a failing publish answers 500 instead of an empty 200", async () => {
  const deps = spies();
  deps.getPassage = async () => {
    throw new Error("passage unavailable");
  };
  await withApp(deps, async ({ post }) => {
    const res = await post("/api/daily", { pwd: "s3cret" });

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      ok: false,
      error: "passage unavailable",
    });
  });
});

test("the landing page is served from public/", async () => {
  await withApp(spies(), async ({ baseUrl }) => {
    const res = await fetch(baseUrl + "/");

    assert.equal(res.status, 200);
    assert.match(await res.text(), /Kur'an/);
  });
});
