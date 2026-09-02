/**
 * Fetches rows in 1000-row chunks, in parallel when the total count is known.
 * Supabase caps responses at 1000 rows per request.
 */
export async function fetchInChunks<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  total: number | null | undefined,
  options?: { chunk?: number; concurrency?: number }
): Promise<T[]> {
  const chunk = options?.chunk ?? 1000;
  const concurrency = options?.concurrency ?? 4;

  // Unknown total: fall back to sequential paging until a short page arrives.
  if (total == null) {
    const all: T[] = [];
    for (let offset = 0; ; offset += chunk) {
      const { data, error } = await makeQuery(offset, offset + chunk - 1);
      if (error || !data) break;
      all.push(...data);
      if (data.length < chunk) break;
    }
    return all;
  }

  if (total === 0) return [];

  const pages = Math.ceil(total / chunk);
  const results: T[][] = new Array(pages).fill(null).map(() => []);
  let next = 0;

  async function worker() {
    for (;;) {
      const page = next++;
      if (page >= pages) return;
      const { data, error } = await makeQuery(page * chunk, page * chunk + chunk - 1);
      if (!error && data) results[page] = data;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pages) }, () => worker())
  );

  return results.flat();
}
