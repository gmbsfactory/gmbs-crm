"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function AnalyticsFilterBar() {
    const [date, setDate] = React.useState<Date>()

    return (
        <div className="flex flex-col gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Filtres</h2>
                <div className="flex items-center gap-2">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Secteur" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les secteurs</SelectItem>
                            <SelectItem value="tech">Tech</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="services">Services</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select defaultValue="fr">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Zone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fr">France</SelectItem>
                            <SelectItem value="eu">Europe</SelectItem>
                            <SelectItem value="world">Monde</SelectItem>
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    )
}
