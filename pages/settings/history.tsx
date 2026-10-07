import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, dataTableFeatures } from "@/components/custom/data-table";
import type { PlaySession } from "@/lib/utils/interface";
import { formatDateTime, formatMinutes } from "@/lib/utils/formatter";

const columns: ColumnDef<typeof dataTableFeatures, PlaySession>[] = [
  { accessorKey: "instanceId", header: "Instance" },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => formatDateTime(row.original.startedAt),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => formatMinutes(row.original.duration, "min"),
  },
  {
    accessorKey: "crashed",
    header: "Status",
    cell: ({ row }) => (row.original.crashed ? "Crash" : "Exited"),
  },
];
function getSearchText(item: PlaySession) {
  return item.instanceId + " " + (item.crashed ? "Crash" : "Exited");
}
export function LaunchHistory({ history }: { history: PlaySession[] }) {
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.startedAt - a.startedAt),
    [history],
  );
  return (
    <DataTable
      data={sorted}
      columns={columns}
      getSearchText={getSearchText}
      searchLabel="Search launch history"
      emptyLabel={
        history.length ? "No matching sessions." : "Chưa có phiên chơi."
      }
    />
  );
}
