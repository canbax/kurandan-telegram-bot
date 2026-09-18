const test = require("node:test");
const assert = require("node:assert/strict");
const {
  appendToBudget,
  buildPassage,
  createBudget,
  pickRandomPassageStart,
} = require("../src/passage");
const { editions } = require("../src/editions");
const { createLocalQuranClient } = require("../src/quran");

/** Serves canned verses and records which ones were asked for. */
function fakeQuran(versesByVerseId, calls = []) {
  return async (surahId, verseId) => {
    calls.push([surahId, verseId]);
    const verse = versesByVerseId[verseId];
    if (!verse) {
      throw new Error(`no fake verse ${surahId}:${verseId}`);
    }
    return { footnotes: "", ...verse };
  };
}

const author = { id: 6, name: "Ali Bulaç" };

function passageArgs(overrides) {
  return {
    surahId: 1,
    firstVerseId: 1,
    verseCount: 7,
    surahName: "Fatiha",
    author,
    charLimit: 100,
    ...overrides,
  };
}

test("a short surah-ending verse produces text plus a single-verse footer", async () => {
  const text = await buildPassage(
    passageArgs({
      firstVerseId: 7,
      fetchVerse: fakeQuran({ 7: { text: "son ayet" } }),
    })
  );

  assert.equal(text, "son ayet\nAli Bulaç meali, Fatiha 1/7");
});

test("consecutive verses are joined with a space and the footer shows a range", async () => {
  const calls = [];
  const text = await buildPassage(
    passageArgs({
      firstVerseId: 5,
      fetchVerse: fakeQuran(
        { 5: { text: "bes" }, 6: { text: "alti" }, 7: { text: "yedi" } },
        calls
      ),
    })
  );

  assert.equal(text, "bes alti yedi\nAli Bulaç meali, Fatiha 1/5-7");
  assert.deepEqual(calls, [
    [1, 5],
    [1, 6],
    [1, 7],
  ]);
});

test("it never reads past the last verse of the surah", async () => {
  const calls = [];
  await buildPassage(
    passageArgs({
      verseCount: 2,
      fetchVerse: fakeQuran({ 1: { text: "bir" }, 2: { text: "iki" } }, calls),
    })
  );

  assert.deepEqual(calls, [
    [1, 1],
    [1, 2],
  ]);
});

test("footnotes are appended after the verse they belong to", async () => {
  const text = await buildPassage(
    passageArgs({
      firstVerseId: 7,
      fetchVerse: fakeQuran({
        7: { text: "ayet", footnotes: "\n([1] not)" },
      }),
    })
  );

  assert.equal(text, "ayet\n([1] not)\nAli Bulaç meali, Fatiha 1/7");
});

test("an over-long verse is truncated with an ellipsis", async () => {
  const footer = "\nAli Bulaç meali, Fatiha 1/7";
  const charLimit = 40;
  const text = await buildPassage(
    passageArgs({
      charLimit,
      firstVerseId: 7,
      fetchVerse: fakeQuran({ 7: { text: "x".repeat(200) } }),
    })
  );

  assert.equal(text, "x".repeat(charLimit - footer.length - 3) + "..." + footer);
  assert.equal(text.length, charLimit);
});

test("the body plus a single-verse footer stays within the limit", async () => {
  const text = await buildPassage(
    passageArgs({
      charLimit: 60,
      firstVerseId: 7,
      fetchVerse: fakeQuran({ 7: { text: "kisa ayet ".repeat(20) } }),
    })
  );

  assert.ok(text.length <= 60, `expected <= 60, got ${text.length}`);
});

test("the verses stop as soon as the budget runs out", async () => {
  const calls = [];
  const text = await buildPassage(
    passageArgs({
      charLimit: 50,
      fetchVerse: fakeQuran(
        {
          1: { text: "a".repeat(10) },
          2: { text: "b".repeat(10) },
          3: { text: "c".repeat(100) },
          4: { text: "d" },
        },
        calls
      ),
    })
  );

  assert.ok(text.includes("..."), "expected a truncated tail");
  assert.deepEqual(
    calls.map(([, verseId]) => verseId),
    [1, 2, 3],
    "verse 4 should never be requested"
  );
  assert.ok(text.endsWith("Fatiha 1/1-3"), `unexpected footer in: ${text}`);
});

test("appendToBudget reports whether the chunk fit", () => {
  const budget = createBudget(5);

  assert.equal(appendToBudget(budget, "abc"), true);
  assert.equal(budget.remaining, 2);
  assert.equal(appendToBudget(budget, "defgh"), false);
  assert.equal(budget.remaining, 0);
  assert.equal(budget.parts.join(""), "abc...");
});

test("pickRandomPassageStart stays inside the real Qur'an's bounds", () => {
  for (let i = 0; i < 300; i++) {
    const start = pickRandomPassageStart();

    assert.ok(start.surahId >= 1 && start.surahId <= 114);
    assert.ok(start.firstVerseId >= 1 && start.firstVerseId <= start.verseCount);
    assert.equal(typeof start.surahName, "string");
    assert.ok(start.surahName.length > 0);
    assert.equal(typeof start.author.id, "string");
  }
});

test("pickRandomPassageStart is deterministic for a fixed rng", () => {
  assert.deepEqual(pickRandomPassageStart(() => 0), {
    surahId: 1,
    firstVerseId: 1,
    verseCount: 7,
    surahName: "Fatiha",
    author: editions[0],
  });
});

test("every translation it can pick is actually bundled", async () => {
  const quran = createLocalQuranClient();
  try {
    for (const edition of editions) {
      assert.equal(typeof edition.name, "string");
      assert.ok(edition.name.length > 0);
      // Rejects unless data/quran/<id>.qdb exists and has a valid header.
      const verses = await quran.fetchSurah(1, edition.id);
      assert.equal(verses.length, 7);
    }
  } finally {
    quran.close();
  }
});
