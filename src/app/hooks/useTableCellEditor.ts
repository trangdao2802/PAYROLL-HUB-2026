import { useCallback, useRef, useState } from "react";

/** Keep the original row and latest input across recalculation, sorting and blur. */
export function useTableCellEditor<Row, Cell>(onCommit?: (row: Row, field: string, value: string) => void) {
  const [editingCell, setEditingCell] = useState<Cell | null>(null);
  const [editValue, setValue] = useState("");
  const session = useRef<{ row: Row; field: string; value: string } | null>(null);

  const beginEdit = useCallback((cell: Cell, row: Row, field: string, value: unknown) => {
    const text = String(value ?? "");
    session.current = { row, field, value: text };
    setEditingCell(cell);
    setValue(text);
  }, []);

  const setEditValue = useCallback((value: string) => {
    if (session.current) session.current.value = value;
    setValue(value);
  }, []);

  const cancelEdit = useCallback(() => {
    session.current = null;
    setEditingCell(null);
  }, []);

  const commitEdit = useCallback(() => {
    const pending = session.current;
    // Enter may be followed by blur before React renders. Commit only once;
    // Escape clears this same session so its subsequent blur cannot save it.
    session.current = null;
    setEditingCell(null);
    if (pending) onCommit?.(pending.row, pending.field, pending.value);
  }, [onCommit]);

  return { editingCell, editValue, beginEdit, setEditValue, commitEdit, cancelEdit };
}
