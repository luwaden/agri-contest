/**
 * Reads a long tab in slices of rows instead of one huge response.
 * One 6,000-row download can take minutes on a slow connection and then time out; small slices finish,
 * and a failed slice is retried on its own (gaxios retries GETs on timeouts and dropped connections).
 *
 * Row positions must stay exact: the app updates rows by their number. Google leaves out blank rows at the
 * END of each slice, so a slice that ends in blank rows is padded back to full length when a later slice has data.
 */
export async function readInChunks(
  totalRows: number,
  size: number,
  fetchRows: (firstRow: number, lastRow: number) => Promise<string[][]>,
): Promise<string[][]> {
  const out: string[][] = [];
  for (let first = 1; first <= totalRows; first += size) {
    const last = Math.min(totalRows, first + size - 1);
    const part = await fetchRows(first, last);
    if (!part.length) continue;
    while (out.length < first - 1) out.push([]);   // blank rows Google trimmed from the previous slice
    for (const row of part) out.push(row);
  }
  return out;
}
