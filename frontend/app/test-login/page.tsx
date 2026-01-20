
'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState } from "react"

const TEST_USERS = [
    { label: "Student Grade 3", email: "student3@test.com", password: "password123" },
    { label: "Student Grade 5", email: "student5@test.com", password: "password123" },
]

export default function TestLoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (email: string) => {
        setLoading(true)
        setError('')

        // Attempt sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: "password123"
        })

        if (signInError) {
            // If user doesn't exist, try to sign up (Mocking 'Create Test Account' flow on demand)
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password: "password123"
            })

            if (signUpError) {
                setError(signUpError.message)
                setLoading(false)
                return
            }
        }

        router.push('/dashboard')
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Test User Login</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {error && <div className="text-red-500 text-sm">{error}</div>}

                    {TEST_USERS.map((u) => (
                        <Button
                            key={u.email}
                            onClick={() => handleLogin(u.email)}
                            disabled={loading}
                            variant="outline"
                            className="justify-start h-auto py-4"
                        >
                            <div className="text-left">
                                <div className="font-semibold">{u.label}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                        </Button>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
