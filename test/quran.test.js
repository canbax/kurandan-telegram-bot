const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { SURAH_COUNT, pack } = require("../src/qdb");
const { createLocalQuranClient } = require("../src/quran");

/**
 * Builds a throwaway data directory holding one synthetic translation, so these
 * tests never depend on the 10 MB of real data being present.
 */
async function withFixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qdb-test-"));
  const surahs = Array.from({ length: SURAH_COUNT }, (_, i) =>
    Array.from({ length: i + 1 }, (_, j) => `ayet ${i + 1}/${j + 1} çğışöü`)
  );
  fs.writeFileSync(path.join(dir, "tur-fake.qdb"), pack(surahs));

  const quran = createLocalQuranClient({ dataDir: dir });
  try {
    // Awaited, not just returned, so the cleanup below cannot run while the
    // test is still mid-read.
    return await run(quran, dir);
  } finally {
    quran.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("fetchVerse returns the verse and an empty footnote string", async () => {
  await withFixture(async (quran) => {
    assert.deepEqual(await quran.fetchVerse(3, 2, "tur-fake"), {
      text: "ayet 3/2 çğışöü",
      footnotes: "",
    });
  });
});

test("fetchVerse reaches the first and last verse of a surah", async () => {
  await withFixture(async (quran) => {
    const first = await quran.fetchVerse(114, 1, "tur-fake");
    const last = await quran.fetchVerse(114, 114, "tur-fake");

    assert.equal(first.text, "ayet 114/1 çğışöü");
    assert.equal(last.text, "ayet 114/114 çğışöü");
  });
});

test("fetchSurah hands back the whole surah in order", async () => {
  await withFixture(async (quran) => {
    const verses = await quran.fetchSurah(5, "tur-fake");

    assert.equal(verses.length, 5);
    assert.equal(verses[0], "ayet 5/1 çğışöü");
    assert.equal(verses[4], "ayet 5/5 çğışöü");
  });
});

test("a surah is read off disk once, then served from the cache", async () => {
  await withFixture(async (quran) => {
    const reads = [];
    const real = fs.readSync;
    fs.readSync = (...args) => {
      reads.push(args[4]); // the file position being read from
      return real(...args);
    };

    try {
      await quran.fetchVerse(7, 1, "tur-fake");
      // One read for the 920-byte header, one for the surah block.
      assert.equal(reads.length, 2);

      await quran.fetchVerse(7, 2, "tur-fake");
      await quran.fetchVerse(7, 7, "tur-fake");
      assert.equal(reads.length, 2, "cached surah should not touch the disk");

      await quran.fetchVerse(8, 1, "tur-fake");
      // A different surah costs one more block read, but not another header.
      assert.equal(reads.length, 3);
    } finally {
      fs.readSync = real;
    }
  });
});

test("the surah cache is bounded", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qdb-test-"));
  const surahs = Array.from({ length: SURAH_COUNT }, (_, i) => [`s${i + 1}`]);
  fs.writeFileSync(path.join(dir, "tur-fake.qdb"), pack(surahs));

  const quran = createLocalQuranClient({ dataDir: dir, cacheSize: 4 });
  try {
    for (let surahId = 1; surahId <= 20; surahId++) {
      await quran.fetchVerse(surahId, 1, "tur-fake");
    }

    const reads = [];
    const real = fs.readSync;
    fs.readSync = (...args) => {
      reads.push(args[4]);
      return real(...args);
    };
    try {
      // Surah 1 was evicted long ago, so it has to come off disk again.
      await quran.fetchVerse(1, 1, "tur-fake");
      assert.equal(reads.length, 1);

      // Surah 20 is still one of the last four touched.
      await quran.fetchVerse(20, 1, "tur-fake");
      assert.equal(reads.length, 1);
    } finally {
      fs.readSync = real;
    }
  } finally {
    quran.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown translation fails with a clear message", async () => {
  await withFixture(async (quran) => {
    await assert.rejects(
      () => quran.fetchVerse(1, 1, "tur-nope"),
      /no bundled translation "tur-nope"/
    );
  });
});

test("an edition id may not escape the data directory", async () => {
  await withFixture(async (quran) => {
    for (const bad of ["../secret", "/etc/passwd", "tur/fake", ""]) {
      await assert.rejects(
        () => quran.fetchVerse(1, 1, bad),
        /invalid edition id/,
        `expected ${JSON.stringify(bad)} to be rejected`
      );
    }
  });
});

test("out-of-range surahs and verses are rejected", async () => {
  await withFixture(async (quran) => {
    await assert.rejects(
      () => quran.fetchVerse(0, 1, "tur-fake"),
      /surah 0 is out of range/
    );
    await assert.rejects(
      () => quran.fetchVerse(115, 1, "tur-fake"),
      /surah 115 is out of range/
    );
    // Surah 3 has exactly 3 verses in the fixture.
    await assert.rejects(
      () => quran.fetchVerse(3, 4, "tur-fake"),
      /verse 3\/4 is out of range \(1-3\)/
    );
    await assert.rejects(
      () => quran.fetchVerse(3, 0, "tur-fake"),
      /verse 3\/0 is out of range/
    );
  });
});

test("a file that is not a .qdb is rejected rather than read as one", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qdb-test-"));
  fs.writeFileSync(path.join(dir, "tur-broken.qdb"), Buffer.alloc(2000));

  const quran = createLocalQuranClient({ dataDir: dir });
  try {
    await assert.rejects(
      () => quran.fetchVerse(1, 1, "tur-broken"),
      /bad magic/
    );
  } finally {
    quran.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
