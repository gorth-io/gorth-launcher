import { useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<typeof dataTableFeatures, T>[];
  getSearchText: (item: T) => string;
  searchLabel: string;
  emptyLabel: string;
}

function DataTable<T extends { id: string }>({
  data,
  columns,
  getSearchText,
  searchLabel,
  emptyLabel,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? data.filter((item) =>
          getSearchText(item).toLocaleLowerCase().includes(query),
        )
      : data;
  }, [data, search, getSearchText]);
  const table = useTable({
    features: dataTableFeatures,
    data: filtered,
    columns,
    getRowId: (item) => item.id,
  });
  const rows = table.getRowModel().rows;
  const virtual = rows.length > 50;
  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: virtual,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index].id,
    estimateSize: () => 64,
    overscan: 8,
    initialRect: { width: 0, height: 480 },
    scrollMargin: 40,
  });
  const items = virtualizer.getVirtualItems();
  const first = items[0];
  const last = items[items.length - 1];
  const visible = virtual
    ? items.map((item) => ({ row: rows[item.index], index: item.index }))
    : rows.map((row, index) => ({ row, index }));

  return (
    <div className="space-y-2">
      <Input
        className="h-9"
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }}
      />
      <div
        ref={scrollRef}
        className="max-h-[480px] overflow-auto rounded-md border"
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    {!header.isPlaceholder &&
                      (header.column.getCanSort() ? (
                        <Button
                          className="h-9 justify-start px-0"
                          variant="ghost"
                          onClick={() => {
                            header.column.toggleSorting();
                            if (scrollRef.current)
                              scrollRef.current.scrollTop = 0;
                          }}
                        >
                          <table.FlexRender header={header} />
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="size-4" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="size-4" />
                          ) : (
                            <ArrowUpDown className="size-4" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      ))}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {virtual && first && first.start > 40 && (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{ height: first.start - 40 }}
                />
              </TableRow>
            )}
            {visible.map(({ row, index }) => (
              <TableRow
                key={row.id}
                data-index={index}
                ref={virtual ? virtualizer.measureElement : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {virtual && last && (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{
                    height: Math.max(
                      0,
                      virtualizer.getTotalSize() - (last.end - 40),
                    ),
                  }}
                />
              </TableRow>
            )}
            {!rows.length && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} / {data.length}
      </p>
    </div>
  );
}
export { DataTable, dataTableFeatures };
export type { DataTableProps };
