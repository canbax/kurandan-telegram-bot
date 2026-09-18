const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HEADER_BYTES,
  SURAH_COUNT,
  pack,
  parseHeader,
  unpackBlock,
} = require("../src/qdb");

/** 114 surahs where surah n holds n verses, each tagged so it is identifiable. */
function fixture(decorate = (s, v) => `surah ${s} verse ${v}`) {
  return Array.from({ length: SURAH_COUNT }, (_, i) =>
    Array.from({ length: i + 1 }, (_, j) => decorate(i + 1, j + 1))
  );
}

/** Pulls one surah back out of a packed buffer the way quran.js does. */
function readSurah(packed, surahId) {
  const { offset, length } = parseHeader(packed.subarray(0, HEADER_BYTES))[
    surahId - 1
  ];
  return unpackBlock(packed.subarray(offset, offset + length));
}

test("the header is a fixed 920 bytes and starts with the magic", () => {
  assert.equal(HEADER_BYTES, 920);

  const packed = pack(fixture());

  assert.equal(packed.toString("ascii", 0, 4), "QDB1");
  assert.equal(packed.readUInt32LE(4), SURAH_COUNT);
  assert.equal(parseHeader(packed).length, SURAH_COUNT);
});

test("every surah survives a pack / parse / unpack round trip", () => {
  const surahs = fixture();
  const packed = pack(surahs);

  for (let surahId = 1; surahId <= SURAH_COUNT; surahId++) {
    assert.deepEqual(readSurah(packed, surahId), surahs[surahId - 1]);
  }
});

test("Turkish letters and pipes come back unchanged", () => {
  // "|" is the field separator in the upstream source but carries no meaning
  // inside a block, so it has to survive as ordinary text.
  const surahs = fixture((s, v) => `ş ğ ı İ ç ö ü Ş Ğ Ç Ö Ü | ${s}/${v}`);
  const packed = pack(surahs);

  assert.deepEqual(readSurah(packed, 3), surahs[2]);
  assert.equal(readSurah(packed, 1)[0], "ş ğ ı İ ç ö ü Ş Ğ Ç Ö Ü | 1/1");
});

test("blocks sit back to back right after the header", () => {
  const index = parseHeader(pack(fixture()));

  assert.equal(index[0].offset, HEADER_BYTES);
  for (let i = 1; i < index.length; i++) {
    assert.equal(index[i].offset, index[i - 1].offset + index[i - 1].length);
  }
});

test("pack refuses input that is not a whole Qur'an", () => {
  assert.throws(() => pack(fixture().slice(0, 113)), /expected 114 surahs/);
  assert.throws(() => pack(undefined), /expected 114 surahs/);

  const noVerses = fixture();
  noVerses[41] = [];
  assert.throws(() => pack(noVerses), /surah 42 has no verses/);
});

test("pack refuses a verse holding the record separator", () => {
  const withNewline = fixture();
  withNewline[0][0] = "first half\nsecond half";

  assert.throws(() => pack(withNewline), /verse 1\/1 contains a newline/);
});

test("parseHeader rejects anything that is not a .qdb file", () => {
  assert.throws(() => parseHeader(Buffer.alloc(16)), /too short/);
  assert.throws(() => parseHeader(Buffer.alloc(HEADER_BYTES)), /bad magic/);

  const wrongCount = pack(fixture());
  wrongCount.writeUInt32LE(113, 4);
  assert.throws(() => parseHeader(wrongCount), /expected 114 surahs in index/);
});
