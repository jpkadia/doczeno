"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  accessorFn?: (row: T) => string | number | undefined | null;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  toolbarExtra?: React.ReactNode;
  emptyMessage?: string;
  exportFileName?: string;
  enableExportExcel?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = "Search records...",
  searchFilter,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  toolbarExtra,
  emptyMessage = "No records found.",
  exportFileName = "table_data",
  enableExportExcel = true,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // 1. Search Filter
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }

    return data.filter((item) => {
      return columns.some((col) => {
        let val: any;
        if (col.accessorFn) {
          val = col.accessorFn(item);
        } else if (col.key in item) {
          val = item[col.key];
        }
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery, searchFilter, columns]);

  // Reset page when filter or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  // 2. Sorting
  const sortedData = React.useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = col.accessorFn ? col.accessorFn(a) : a[col.key];
      const bVal = col.accessorFn ? col.accessorFn(b) : b[col.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  // 3. Pagination
  const totalRows = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const startRow = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRow = Math.min(safePage * pageSize, totalRows);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleExportExcel = () => {
    try {
      if (!filteredData || filteredData.length === 0) {
        toast.error("No data available to export.");
        return;
      }

      // 1. Identify exportable columns (skip actions, controls, etc.)
      const exportableColumns = columns.filter((col) => {
        const key = col.key.toLowerCase();
        return key !== "actions" && key !== "action" && key !== "select" && key !== "operations";
      });

      if (exportableColumns.length === 0) {
        toast.error("No exportable columns found.");
        return;
      }

      // 2. Generate Header Row
      const headers = exportableColumns.map((col) => {
        if (typeof col.header === "string") return col.header;
        return col.key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
      });

      // 3. Generate Data Rows
      const rows = filteredData.map((row) => {
        return exportableColumns.map((col) => {
          let val: any;
          if (col.accessorFn) {
            val = col.accessorFn(row);
          } else if (col.key in row) {
            val = row[col.key];
          }

          if (val === null || val === undefined) return "";
          if (val instanceof Date) return val.toLocaleDateString("en-IN");
          if (typeof val === "boolean") return val ? "Yes" : "No";
          if (typeof val === "object") return "";
          return String(val);
        });
      });

      // 4. Build CSV string with UTF-8 BOM (\uFEFF) for full Excel compatibility
      const escapeCsvField = (field: string) => {
        const str = String(field);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const csvContent =
        "\uFEFF" +
        [
          headers.map(escapeCsvField).join(","),
          ...rows.map((r) => r.map(escapeCsvField).join(",")),
        ].join("\r\n");

      // 5. Trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeFileName = (exportFileName || "export")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute("download", `${safeFileName}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Excel sheet downloaded successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel. Please try again.");
    }
  };

  return (
    <div className="space-y-3.5 w-full">
      {/* Toolbar: Global Search & Additional Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs bg-white border-slate-200 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-[#1a76d1]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {toolbarExtra}
          {enableExportExcel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className="h-9 px-3 text-xs font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Download table data in Excel format"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/90 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "text-[11px] font-semibold text-slate-600 uppercase tracking-wider py-3 px-4",
                      col.headerClassName
                    )}
                  >
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors uppercase font-semibold text-[11px]"
                      >
                        <span>{col.header}</span>
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-[#1a76d1]" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-[#1a76d1]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <TableRow
                    key={(row as any).id || (row as any)._id || idx}
                    className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors"
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn("py-3 px-4 text-xs text-slate-700", col.className)}
                      >
                        {col.cell
                          ? col.cell(row)
                          : col.accessorFn
                          ? col.accessorFn(row)
                          : (row as any)[col.key] ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-28 text-center text-xs text-slate-400"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination & Footer Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-700">{startRow}</span> to{" "}
              <span className="font-semibold text-slate-700">{endRow}</span> of{" "}
              <span className="font-semibold text-slate-700">{totalRows}</span> results
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Rows per page:</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 text-[11px] border border-slate-200 rounded px-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-2">
              Page{" "}
              <span className="font-semibold text-slate-700">{safePage}</span> of{" "}
              <span className="font-semibold text-slate-700">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              className="h-7 w-7 p-0 text-slate-600 disabled:opacity-40"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-7 w-7 p-0 text-slate-600 disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-7 w-7 p-0 text-slate-600 disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              className="h-7 w-7 p-0 text-slate-600 disabled:opacity-40"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
