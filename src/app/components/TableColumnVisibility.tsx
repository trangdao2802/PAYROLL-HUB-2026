import { SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function TableColumnVisibility({ columns, hidden, onChange }: {
  columns: readonly { key: string; label: string }[];
  hidden: ReadonlySet<string>;
  onChange: (columns: Set<string>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Columns" title="Show/hide columns"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary hover:bg-muted active:scale-[0.98]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="z-[99999] max-h-80 w-60 overflow-y-auto bg-popover">
        <DropdownMenuLabel>Columns ({columns.filter((column) => !hidden.has(column.key)).length}/{columns.length})</DropdownMenuLabel>
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onChange(new Set()); }}>Show all</DropdownMenuItem>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem key={column.key} checked={!hidden.has(column.key)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => {
              const next = new Set(hidden);
              if (checked) next.delete(column.key);
              else next.add(column.key);
              onChange(next);
            }}>
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
