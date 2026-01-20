
'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"

interface Profile {
    full_name: string
    age: number
    grade_level: string
    interests: string[]
}

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile>({
        full_name: '',
        age: 8,
        grade_level: '3',
        interests: []
    })
    const [interestInput, setInterestInput] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function getProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            setUser(user)

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    age: data.age || 8,
                    grade_level: data.grade_level || '3',
                    interests: data.interests || []
                })
            }
            setLoading(false)
        }
        getProfile()
    }, [router])

    const handleSave = async () => {
        if (!user) return

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                ...profile,
                updated_at: new Date().toISOString()
            })

        if (!error) {
            router.push('/dashboard')
        } else {
            alert('Error saving profile: ' + error.message)
        }
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="container max-w-2xl py-8">
            <Card>
                <CardHeader>
                    <CardTitle>My Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={profile.full_name}
                            onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                            placeholder="Enter your name"
                        />
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Age</label>
                        <Input
                            type="number"
                            value={profile.age}
                            onChange={(e) => setProfile(p => ({ ...p, age: parseInt(e.target.value) }))}
                        />
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Grade Level</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={profile.grade_level}
                            onChange={(e) => setProfile(p => ({ ...p, grade_level: e.target.value }))}
                        >
                            {['K', '1', '2', '3', '4', '5', '6'].map(g => (
                                <option key={g} value={g}>Grade {g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Interests (Press Enter to add)</label>
                        <Input
                            value={interestInput}
                            onChange={(e) => setInterestInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && interestInput) {
                                    e.preventDefault()
                                    setProfile(p => ({ ...p, interests: [...p.interests, interestInput] }))
                                    setInterestInput('')
                                }
                            }}
                            placeholder="e.g. Dinosaurs, Space, Soccer"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {profile.interests.map((tag, i) => (
                                <div key={i} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-2">
                                    {tag}
                                    <button
                                        onClick={() => setProfile(p => ({
                                            ...p,
                                            interests: p.interests.filter((_, idx) => idx !== i)
                                        }))}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button className="w-full mt-4" onClick={handleSave}>
                        Save Profile
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
