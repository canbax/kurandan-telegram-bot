const test = require("node:test");
const assert = require("node:assert/strict");
const { createAcikKuranClient, formatFootnotes } = require("../src/acikkuran");

test("formatFootnotes returns an empty string when there are none", () => {
  assert.equal(formatFootnotes(null), "");
  assert.equal(formatFootnotes(undefined), "");
  assert.equal(formatFootnotes([]), "");
});

test("formatFootnotes numbers the notes inside one parenthesised block", () => {
  const out = formatFootnotes([{ text: "first" }, { text: "second" }]);
  assert.equal(out, "\n([1] first [2] second)");
});

test("fetchVerse builds the right URL and flattens the response", async () => {
  const calls = [];
  const client = createAcikKuranClient({
    baseUrl: "https://example.test",
    fetchJson: async (url) => {
      calls.push(url);
      return {
        data: { translation: { text: "verse text", footnotes: [{ text: "n" }] } },
      };
    },
  });

  const verse = await client.fetchVerse(2, 255, 6);

  assert.deepEqual(calls, [
    "https://example.test/surah/2/verse/255?author=6",
  ]);
  assert.deepEqual(verse, { text: "verse text", footnotes: "\n([1] n)" });
});

test("fetchVerse yields empty footnotes when the API sends none", async () => {
  const client = createAcikKuranClient({
    fetchJson: async () => ({ data: { translation: { text: "t" } } }),
  });

  assert.deepEqual(await client.fetchVerse(1, 1, 3), {
    text: "t",
    footnotes: "",
  });
});
