const test = require("node:test");
const assert = require("node:assert/strict");
const { getRandomInt, pickRandom } = require("../src/random");

test("getRandomInt returns the lower bound when rng yields 0", () => {
  assert.equal(getRandomInt(1, 114, () => 0), 1);
});

test("getRandomInt returns the upper bound when rng is just under 1", () => {
  assert.equal(getRandomInt(1, 114, () => 0.999999), 114);
});

test("getRandomInt covers the whole inclusive range", () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    seen.add(getRandomInt(1, 3));
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test("pickRandom picks by index", () => {
  const items = ["a", "b", "c"];
  assert.equal(pickRandom(items, () => 0), "a");
  assert.equal(pickRandom(items, () => 0.5), "b");
  assert.equal(pickRandom(items, () => 0.99), "c");
});
