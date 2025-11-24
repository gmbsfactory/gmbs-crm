"use client"

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef, useState, useMemo, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface VirtualizedDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    title?: string
    searchPlaceholder?: string
    searchColumn?: string
    height?: number
}

export function VirtualizedDataTable<TData, TValue>({
    columns,
    data,
    title,
    searchPlaceholder = "Rechercher...",
    searchColumn,
    height = 400,
}: VirtualizedDataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState("")

    // Filter data based on global filter if searchColumn is provided
    const filteredData = useMemo(() => {
        if (!globalFilter || !searchColumn) return data
        return data.filter((item: any) => {
            const value = item[searchColumn]
            return String(value).toLowerCase().includes(globalFilter.toLowerCase())
        })
    }, [data, globalFilter, searchColumn])

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
        },
    })

    const { rows } = table.getRowModel()

    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45, // Estimated row height
        overscan: 10,
    })

    // Force recalculation when data changes
    useEffect(() => {
        virtualizer.measure()
    }, [rows.length, virtualizer])

    return (
        <Card>
            {title && (
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle>{title}</CardTitle>
                        {searchColumn && (
                            <Input
                                placeholder={searchPlaceholder}
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="max-w-sm h-8"
                            />
                        )}
                    </div>
                </CardHeader>
            )}
            <CardContent className="p-0">
                <div className="rounded-md border">
                    {/* Virtualized Body with Header */}
                    <div
                        ref={parentRef}
                        style={{
                            height: `${height}px`,
                            overflow: "auto",
                            position: "relative",
                        }}
                        className="w-full"
                    >
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => {
                                                const columnSize = header.column.getSize() || 150
                                                return (
                                                    <TableHead 
                                                        key={header.id} 
                                                        colSpan={header.colSpan}
                                                        style={{
                                                            width: columnSize,
                                                            minWidth: columnSize,
                                                            maxWidth: columnSize,
                                                        }}
                                                    >
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                    </TableHead>
                                                )
                                            })}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        if (!row) return null
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    height: `${virtualRow.size}px`,
                                                    display: "table-row",
                                                }}
                                            >
                                                {row.getVisibleCells().map((cell) => {
                                                    const columnSize = cell.column.getSize() || 150
                                                    return (
                                                        <TableCell
                                                            key={cell.id}
                                                            style={{
                                                                width: columnSize,
                                                                minWidth: columnSize,
                                                                maxWidth: columnSize,
                                                            }}
                                                        >
                                                            {flexRender(
                                                                cell.column.columnDef.cell,
                                                                cell.getContext()
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        )
                                    })}
                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={columns.length}
                                                className="h-24 text-center"
                                            >
                                                Aucun résultat.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
