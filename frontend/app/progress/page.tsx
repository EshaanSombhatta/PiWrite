'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"
import { BarChart, Activity, Book, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface InsightData {
    stats: {
        total_stories: number
        active_stories: number
        total_gaps_identified: number
    }
    strengths: Array<{ domain: string, message: string }>
    weaknesses: Array<{ domain: string, score: number }>
}

export default function ProgressPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<InsightData | null>(null)

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser()

            // STRICT AUTH CHECK as requested
            if (!user) {
                router.push('/login')
                return
            }

            try {
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token

                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003'}/api/insights/student`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })

                if (res.ok) {
                    const jsonData = await res.json()
                    setData(jsonData)
                }
            } catch (error) {
                console.error("Failed to fetch insights", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [router])

    if (loading) return <div className="p-8 flex justify-center text-muted-foreground">Loading Insights...</div>
    if (!data) return <div className="p-8">No data available.</div>

    // Prepare chart data from weaknesses (inverse logic can be applied for mastery, but let's visualize gap frequency for now)
    const chartData = data.weaknesses.map(w => ({
        name: w.domain,
        gaps: w.score
    }))

    return (
        <div className="container py-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Student Progress Insights</h1>
                <p className="text-muted-foreground">
                    Overview of your writing journey, strengths, and areas for growth.
                </p>
            </div>

            {/* Top Stats Row */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
                        <Book className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.total_stories}</div>
                        <p className="text-xs text-muted-foreground">Stories started on PiWrite</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.active_stories}</div>
                        <p className="text-xs text-muted-foreground">Stories in progress</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gaps Identified</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.stats.total_gaps_identified}</div>
                        <p className="text-xs text-muted-foreground">Learning opportunities found</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Strengths Column */}
                <Card className="col-span-1 border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <CardTitle>Your Superpowers</CardTitle>
                        </div>
                        <CardDescription>Areas where you are showing consistent mastery.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.strengths.length > 0 ? data.strengths.map((s, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                                    <div className="mt-1 bg-green-100 p-1.5 rounded-full">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{s.domain}</p>
                                        <p className="text-sm text-gray-500">{s.message}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground">Keep writing to discover your strengths!</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Focus Areas Column */}
                <Card className="col-span-1 border-l-4 border-l-orange-500 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <CardTitle>Focus Areas</CardTitle>
                        </div>
                        <CardDescription>Skills we are working on improving together.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full">
                            {data.weaknesses.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="gaps" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20}>
                                            {
                                                chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ea580c' : '#fb923c'} />
                                                ))
                                            }
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
                                    No major focus areas identified yet. Great work!
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-center pt-8">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-muted-foreground hover:text-primary underline"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    )
}
