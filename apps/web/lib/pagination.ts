export type Page<T> = { items: T[]; total: number; olderCursor: number | null };
export type ReadItems<T> = (cursor: number, limit: number) => Promise<T[]>;

// The registry offers a bounded forward cursor but not a collection count.
// Locate the end with bounded probes, then fetch a newest-first page.
export async function countItems<T>(readItems: ReadItems<T>, pageSize = 10): Promise<number> {
  const first = await readItems(0, pageSize);
  if (first.length < pageSize) return first.length;
  const exists = async (cursor: number) => (await readItems(cursor, 1)).length > 0;
  let lower = pageSize;
  let upper = pageSize;
  while (await exists(upper)) {
    lower = upper + 1;
    upper *= 2;
    if (!Number.isSafeInteger(upper)) throw new Error("链上记录数量超出可处理范围");
  }
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (await exists(middle)) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}

export async function newestPage<T>(readItems: ReadItems<T>, before?: number, pageSize = 10): Promise<Page<T>> {
  const total = await countItems(readItems, pageSize);
  const end = before === undefined ? total : Math.min(Math.max(0, before), total);
  const start = Math.max(0, end - pageSize);
  const items = end > start ? await readItems(start, end - start) : [];
  return { items: items.reverse(), total, olderCursor: start > 0 ? start : null };
}
