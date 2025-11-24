"use client"

import { useState } from "react"
import { Send, Sparkles, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AnalyticsData } from "@/hooks/useAnalyticsData"

interface Message {
    role: "user" | "assistant"
    content: string
}

interface AskAIProps {
    analyticsData?: AnalyticsData | null
}

const PRESET_QUESTIONS = [
    "Quels métiers ont le meilleur ratio marge/CAC ?",
    "Quelle est la tendance du churn sur le segment Tech ?",
    "Fais-moi un résumé des performances du mois.",
]

export function AskAI({ analyticsData }: AskAIProps) {
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Bonjour ! Je suis votre assistant analytique. Posez-moi une question sur vos données ou choisissez une suggestion ci-dessous." }
    ])
    const [isLoading, setIsLoading] = useState(false)

    const handleSend = async (text: string = input) => {
        if (!text.trim()) return

        const newMessages = [...messages, { role: "user", content: text } as Message]
        setMessages(newMessages)
        setInput("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/admin/analytics/ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: newMessages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                    analyticsData: analyticsData || null,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Erreur lors de la génération de la réponse")
            }

            const data = await response.json()
            setMessages([
                ...newMessages,
                {
                    role: "assistant",
                    content: data.content || "Désolé, je n'ai pas pu générer de réponse."
                }
            ])
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API:", error)
            setMessages([
                ...newMessages,
                {
                    role: "assistant",
                    content: error instanceof Error 
                        ? `Erreur: ${error.message}` 
                        : "Une erreur est survenue lors de la génération de la réponse. Veuillez réessayer."
                }
            ])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="h-[500px] flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Ask AI
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                        <Bot className="h-5 w-5 text-purple-600" />
                                    </div>
                                )}
                                <div
                                    className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${msg.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                    <Bot className="h-5 w-5 text-purple-600" />
                                </div>
                                <div className="bg-muted rounded-lg px-4 py-2 text-sm italic text-muted-foreground">
                                    Analyse en cours...
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="space-y-4">
                    {messages.length === 1 && (
                        <div className="flex flex-wrap gap-2">
                            {PRESET_QUESTIONS.map((q, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-auto py-2 whitespace-normal text-left"
                                    onClick={() => handleSend(q)}
                                >
                                    {q}
                                </Button>
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSend()
                        }}
                        className="flex gap-2"
                    >
                        <Input
                            placeholder="Posez une question sur vos données..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    )
}
