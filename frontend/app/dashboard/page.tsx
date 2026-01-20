'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Plus, BookOpen, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"

interface Writing {
    id: string
    title: string
    current_stage: string
    updated_at: string
}

export default function DashboardPage() {
    const router = useRouter()
    const [writings, setWritings] = useState<Writing[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            const { data } = await supabase
                .from('writings')
                .select('*')
                .eq('student_id', user.id)
                .order('updated_at', { ascending: false })

            if (data) setWritings(data)
            setLoading(false)
        }
        loadData()
    }, [router])

    const handleNewWriting = async () => {
        if (!user) return

        try {
            // Create a writing entry
            const { data, error } = await supabase
                .from('writings')
                .insert({
                    student_id: user.id,
                    title: 'Untitled Story',
                    current_stage: 'prewriting',
                    genre: 'narrative'
                })
                .select()
                .single()

            if (error) throw error

            router.push(`/workspace/${data.id}`)
        } catch (err: any) {
            alert('Failed to create writing: ' + err.message)
        }
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="container py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Your Stories</h1>
                    <p className="text-muted-foreground">Pick up where you left off or start something new!</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => router.push('/progress')} variant="outline" size="lg" className="gap-2">
                        <TrendingUp className="w-4 h-4" />
                        View Progress
                    </Button>
                    <Button onClick={handleNewWriting} size="lg" className="gap-2">
                        <Plus className="w-4 h-4" />
                        New Story
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {writings.map(w => (
                    <Link href={`/workspace/${w.id}`} key={w.id}>
                        <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                    {w.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span className="capitalize">{w.current_stage}</span>
                                    <span>{new Date(w.updated_at).toLocaleDateString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}

                {writings.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        You haven't written anything yet. Click "New Story" to get started!
                    </div>
                )}
            </div>
        </div>
    )
}
