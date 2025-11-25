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
    noCard?: boolean
}

export function VirtualizedDataTable<TData, TValue>({
    columns,
    data,
    title,
    searchPlaceholder = "Rechercher...",
    searchColumn,
    height = 400,
    noCard = false,
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

    const tableContent = (
        <div className={noCard ? "w-full" : "rounded-md border border-border/50"}>
            {/* Virtualized Body with Header */}
            <div
                ref={parentRef}
                style={{
                    height: `${height}px`,
                    overflowX: "auto",
                    overflowY: "auto",
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
                    <Table style={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHeader className={`sticky top-0 z-10 border-b ${noCard ? "bg-background" : "bg-muted/80 backdrop-blur-sm"}`}>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                    {headerGroup.headers.map((header) => {
                                        const columnSize = header.column.getSize() || 150
                                        return (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                style={{
                                                    width: `${columnSize}px`,
                                                    minWidth: `${columnSize}px`,
                                                    maxWidth: `${columnSize}px`,
                                                }}
                                                className="font-semibold text-muted-foreground text-sm h-12 px-4"
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
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        Aucune donnée disponible.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                virtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = rows[virtualRow.index]
                                    if (!row) return null
                                    return (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected() && "selected"}
                                            className="hover:bg-muted/50 transition-colors border-b"
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "100%",
                                                transform: `translateY(${virtualRow.start}px)`,
                                                height: `${virtualRow.size}px`,
                                                display: "table-row",
                                                tableLayout: "fixed",
                                            }}
                                        >
                                            {row.getVisibleCells().map((cell) => {
                                                const columnSize = cell.column.getSize() || 150
                                                return (
                                                    <TableCell
                                                        key={cell.id}
                                                        style={{
                                                            width: `${columnSize}px`,
                                                            minWidth: `${columnSize}px`,
                                                            maxWidth: `${columnSize}px`,
                                                        }}
                                                        className="p-4 text-sm"
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
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )

    // Si noCard est activé, retourner directement le contenu du tableau
    if (noCard) {
        return tableContent
    }

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
                {tableContent}
            </CardContent>
        </Card>
    )
}
