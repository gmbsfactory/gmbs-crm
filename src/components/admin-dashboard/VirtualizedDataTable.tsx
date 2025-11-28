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
    const headerRef = useRef<HTMLTableSectionElement>(null)
    const [tableWidth, setTableWidth] = useState<number>(0)

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45, // Estimated row height
        overscan: 10,
    })

    // Calculer la largeur totale du tableau basée sur les colonnes
    const totalTableWidth = useMemo(() => {
        return table.getHeaderGroups()[0]?.headers.reduce((sum, header) => {
            return sum + (header.column.getSize() || 150)
        }, 0) || 0
    }, [table])

    // Calculer les proportions de chaque colonne (en pourcentage) - Map par columnId
    const columnProportions = useMemo(() => {
        const headers = table.getHeaderGroups()[0]?.headers || []
        const proportionsMap = new Map<string, { proportion: number; minWidth: number }>()
        headers.forEach((header) => {
            const columnSize = header.column.getSize() || 150
            proportionsMap.set(header.column.id, {
                proportion: totalTableWidth > 0 ? (columnSize / totalTableWidth) * 100 : 0,
                minWidth: columnSize,
            })
        })
        return proportionsMap
    }, [table, totalTableWidth])

    // Mesurer la largeur réelle du header après rendu avec ResizeObserver
    useEffect(() => {
        if (!headerRef.current) return

        const updateTableWidth = () => {
            if (headerRef.current) {
                const headerWidth = headerRef.current.offsetWidth
                if (headerWidth > 0) {
                    setTableWidth(headerWidth)
                }
            }
        }
        
        // Mesurer immédiatement
        updateTableWidth()
        
        // Utiliser ResizeObserver pour détecter les changements de taille
        const resizeObserver = new ResizeObserver(() => {
            updateTableWidth()
        })
        
        resizeObserver.observe(headerRef.current)
        
        // Également écouter les changements de fenêtre
        window.addEventListener('resize', updateTableWidth)
        
        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', updateTableWidth)
        }
    }, [table, columnProportions, filteredData])

    // Force recalculation when data changes
    useEffect(() => {
        virtualizer.measure()
    }, [rows.length, virtualizer])

    const tableContent = (
        <div className={noCard ? "w-full" : "rounded-md border border-border/50"}>
            <div className="w-full overflow-x-auto">
                <div className="min-w-full">
                    {/* Header stays visible; body handles scroll */}
                    <Table style={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHeader
                            ref={headerRef}
                            className={`border-b ${noCard ? "bg-background" : "bg-muted/80 backdrop-blur-sm"}`}
                        >
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                                    {headerGroup.headers.map((header) => {
                                        const columnSize = header.column.getSize() || 150
                                        const columnProps = columnProportions.get(header.column.id)
                                        const proportion = columnProps?.proportion || 0
                                        const minWidth = columnProps?.minWidth || columnSize
                                        return (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                style={{
                                                    width: `${proportion}%`,
                                                    minWidth: `${minWidth}px`,
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
                    </Table>

                    <div
                        ref={parentRef}
                        style={{
                            height: `${height}px`,
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
                                        <>
                                            {virtualizer.getVirtualItems().length > 0 && (
                                                <TableRow style={{ height: `${virtualizer.getVirtualItems()[0]?.start || 0}px` }} aria-hidden="true">
                                                    <TableCell colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                                                </TableRow>
                                            )}
                                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                                const row = rows[virtualRow.index]
                                                if (!row) return null
                                                return (
                                                    <TableRow
                                                        key={row.id}
                                                        style={{
                                                            height: `${virtualRow.size}px`,
                                                        }}
                                                        className="hover:bg-muted/50 transition-colors border-b"
                                                        data-state={row.getIsSelected() ? "selected" : undefined}
                                                    >
                                                        {row.getVisibleCells().map((cell) => {
                                                            const columnSize = cell.column.getSize() || 150
                                                            const columnProps = columnProportions.get(cell.column.id)
                                                            const proportion = columnProps?.proportion || 0
                                                            const minWidth = columnProps?.minWidth || columnSize
                                                            return (
                                                                <TableCell
                                                                    key={cell.id}
                                                                    style={{
                                                                        width: `${proportion}%`,
                                                                        minWidth: `${minWidth}px`,
                                                                        verticalAlign: "middle",
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
                                            })}
                                            {(() => {
                                                const virtualItems = virtualizer.getVirtualItems()
                                                if (virtualItems.length > 0) {
                                                    const lastItem = virtualItems[virtualItems.length - 1]
                                                    const bottomSpacerHeight = virtualizer.getTotalSize() - lastItem.end
                                                    if (bottomSpacerHeight > 0) {
                                                        return (
                                                            <TableRow 
                                                                style={{ height: `${bottomSpacerHeight}px` }} 
                                                                aria-hidden="true"
                                                            >
                                                                <TableCell colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                                                            </TableRow>
                                                        )
                                                    }
                                                }
                                                return null
                                            })()}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
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
