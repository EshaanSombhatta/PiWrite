
'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Send, Bot, User as UserIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export function ChatInterface({
    messages,
    onSendMessage,
    loading,
    suggestions = []
}: {
    messages: Message[],
    onSendMessage: (msg: string) => void
    loading: boolean
    suggestions?: string[]
}) {
    const [input, setInput] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || loading) return
        onSendMessage(input)
        setInput('')
    }

    return (
        <Card className="flex flex-col h-full border-l rounded-none lg:rounded-l-none lg:border-l lg:border-t-0 lg:border-b-0 shadow-none">
            <CardHeader className="py-3 border-b">
                <CardTitle className="text-md flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    PiWrite Coach
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto p-4 space-y-4 pb-20" // Padding for suggestions
                >
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground mt-10">
                            Say hello to get started!
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={cn(
                            "flex w-full items-start gap-2",
                            m.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={cn(
                                "rounded-lg px-4 py-2 max-w-[85%] text-sm",
                                m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex w-full items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Bot className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="p-3 border-t flex flex-col gap-2">
                {/* Suggestions Chips */}
                {suggestions && suggestions.length > 0 && (
                    <div className="flex w-full gap-2 overflow-x-auto pb-2 scrollbar-none">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => onSendMessage(s)}
                                className="whitespace-nowrap px-3 py-1 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs rounded-full border transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex w-full gap-2">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Type a message..."
                        disabled={loading}
                    />
                    <Button type="submit" size="icon" disabled={loading}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    )
}
