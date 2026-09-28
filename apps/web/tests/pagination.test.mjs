import assert from "node:assert/strict";
import test from "node:test";
import { countItems, newestPage } from "../lib/pagination.ts";

function reader(values) {
  return async (cursor, limit) => {
    assert.ok(limit >= 1 && limit <= 10);
    return values.slice(cursor, cursor + limit);
  };
}

for (const length of [0, 1, 9, 10, 11, 20, 21, 37, 100]) {
  test(`finds the end of ${length} append-only entries`, async () => {
    const values = Array.from({ length }, (_, index) => index);
    assert.equal(await countItems(reader(values)), length);
  });
}

test("starts with the newest ten and loads every older entry exactly once", async () => {
  const values = Array.from({ length: 27 }, (_, index) => index);
  const read = reader(values);
  const visited = [];
  let cursor;
  do {
    const page = await newestPage(read, cursor);
    visited.push(...page.items);
    cursor = page.olderCursor ?? undefined;
    if (page.olderCursor === null) break;
  } while (true);
  assert.deepEqual(visited, [...values].reverse());
});
