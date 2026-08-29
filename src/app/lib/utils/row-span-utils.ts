export type RowSpanValue = number;

export interface RowWithGroupAndSpans extends Record<string, unknown> {
  groupId?: unknown;
  _rowSpans?: Record<string, RowSpanValue>;
}

/**
 * Clones rows and marks contiguous, equal cells in the same logical group for
 * native HTML rowSpan rendering. A zero means that the cell is covered by the
 * first row in its group and must not be rendered again.
 */
export function applyContiguousRowSpans<T extends RowWithGroupAndSpans>(
  rows: readonly T[],
  columnKeys: readonly string[],
): T[] {
  if (columnKeys.length === 0 || rows.length === 0) return [...rows];

  const result = rows.map((row) => ({
    ...row,
    _rowSpans: { ...(row._rowSpans || {}) },
  })) as T[];

  for (const columnKey of columnKeys) {
    let spanStartIndex = 0;

    while (spanStartIndex < result.length) {
      let spanLength = 1;
      const firstRow = result[spanStartIndex];

      for (let index = spanStartIndex + 1; index < result.length; index++) {
        const currentRow = result[index];
        const valuesMatch = currentRow[columnKey] === firstRow[columnKey];
        const groupsMatch =
          firstRow.groupId === undefined ||
          currentRow.groupId === undefined ||
          currentRow.groupId === firstRow.groupId;

        if (!valuesMatch || !groupsMatch) break;
        spanLength++;
      }

      firstRow._rowSpans![columnKey] = spanLength;
      for (
        let index = spanStartIndex + 1;
        index < spanStartIndex + spanLength;
        index++
      ) {
        result[index]._rowSpans![columnKey] = 0;
      }

      spanStartIndex += spanLength;
    }
  }

  return result;
}

/** Keeps every logical row group contiguous while applying a table sort. */
export function sortRowsPreservingGroupBlocks<T extends RowWithGroupAndSpans>(
  rows: readonly T[],
  compareRows: (left: T, right: T) => number,
): T[] {
  if (!rows.some((row) => row.groupId !== undefined && row.groupId !== null)) {
    return [...rows].sort(compareRows);
  }

  const groupIndex = new Map<unknown, { order: number; rows: T[] }>();
  const blocks: Array<{ order: number; rows: T[] }> = [];

  rows.forEach((row, order) => {
    const groupId = row.groupId;
    if (groupId === undefined || groupId === null) {
      blocks.push({ order, rows: [row] });
      return;
    }

    const existing = groupIndex.get(groupId);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    const block = { order, rows: [row] };
    groupIndex.set(groupId, block);
    blocks.push(block);
  });

  blocks.forEach((block) => block.rows.sort(compareRows));
  blocks.sort((left, right) => {
    const comparison = compareRows(left.rows[0], right.rows[0]);
    return comparison || left.order - right.order;
  });

  return blocks.flatMap((block) => block.rows);
}
