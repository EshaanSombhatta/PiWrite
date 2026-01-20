
'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { User } from "@supabase/supabase-js"
import { AlertCircle } from "lucide-react"
import Image from "next/image"

export function Header() {
    const [user, setUser] = useState<User | null>(null)
    const router = useRouter()

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <Link href="/" className="mr-6 flex items-center space-x-2 font-bold">
                    <div className="relative h-8 w-8">
                        <Image
                            src="/piwrite-logo.jpg"
                            alt="PiWrite Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-xl text-primary">PiWrite</span>
                </Link>
                <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
                    <Link href="/dashboard" className="transition-colors hover:text-foreground/80">Dashboard</Link>
                    <Link href="/progress" className="transition-colors hover:text-foreground/80">My Progress</Link>
                </nav>
                <div className="flex items-center space-x-4">
                    {user ? (
                        <>
                            <Button variant="ghost" onClick={() => router.push('/profile')}>
                                Profile
                            </Button>
                            <Button variant="outline" onClick={handleSignOut}>
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => router.push('/login')}>Sign In</Button>
                    )}
                </div>
            </div>
        </header>
    )
}
