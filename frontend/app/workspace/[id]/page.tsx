'use client'

import { StageStepper } from "@/components/workspace/stage-stepper"
import { ChatInterface } from "@/components/workspace/chat-interface"
import { InstructionalGaps } from "@/components/workspace/instructional-gaps"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { SafetyToast } from "@/components/layout/safety-toast"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { PublishingWorkspace } from "@/components/workspace/publishing/publishing-workspace"
import { RichTextEditor } from "@/components/workspace/rich-text-editor"

import { User } from "@supabase/supabase-js"

interface WritingState {
    student_id: string
    writing_id: string
    grade_level: string
    current_stage: string
    student_text: string
    last_prompt: string
    student_response: string
    retrieved_standards: any[]
    instructional_gaps: any[]
    messages: { role: 'user' | 'assistant', content: string }[]
    previous_student_text?: string // Added for change detection
}

export default function WorkspacePage() {
    const { id: writingId } = useParams()
    const router = useRouter()

    // State
    const [user, setUser] = useState<User | null>(null)
    const [title, setTitle] = useState('Untitled')
    const [content, setContent] = useState('')
    const [prewritingPlan, setPrewritingPlan] = useState('') // Store plan for reference
    const [stage, setStage] = useState('prewriting')
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
    const [gaps, setGaps] = useState<any[]>([])
    const [standards, setStandards] = useState<any[]>([])
    const [analyzing, setAnalyzing] = useState(false)

    // UI State
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false) // New saving state
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null) // Timestamp
    const [safetyWarning, setSafetyWarning] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(true)

    // Stage Defaults
    const STAGE_DEFAULTS: Record<string, { msg: string, prompts: string[] }> = {
        prewriting: {
            msg: "Welcome to the Brainstorming Cloud! ☁️ I can help you bubble up ideas and plan your story. What's on your mind?",
            prompts: ["I need an idea", "Help me plan", "What do I write about?"]
        },
        drafting: {
            msg: "Let’s get those big ideas onto the page! 🌊 Don’t worry about mistakes yet—just let your story flow.",
            prompts: ["How do I start?", "I'm stuck", "Check my beginning"]
        },
        revising: {
            msg: "Time to add some magic! ✨ We can add 'juicy' words and sensory details to bring your story to life.",
            prompts: ["Add sparkle words", "Make it sound better", "Describe the setting"]
        },
        editing: {
            msg: "Let's put on our Editor Hats! 🎩 We'll check for capitals, punctuation, and spelling to make your writing clear.",
            prompts: ["Check my spelling", "Fix my grammar", "Is this correct?"]
        },
    }

    const [suggestions, setSuggestions] = useState<string[]>([])

    // Load Data
    useEffect(() => {
        async function init() {
            // 1. Auth Check
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)

            // 2. Fetch Writing Metadata
            const { data: writing } = await supabase
                .from('writings')
                .select('*')
                .eq('id', writingId)
                .single()

            if (writing) {
                setTitle(writing.title)
                setStage(writing.current_stage)
                // Set initial suggestions
                if (STAGE_DEFAULTS[writing.current_stage]) {
                    setSuggestions(STAGE_DEFAULTS[writing.current_stage].prompts)
                }

                // FETCH PREWRITING PLAN (Always load it if we are past prewriting, for reference)
                if (writing.current_stage !== 'prewriting') {
                    const { data: planDraft } = await supabase
                        .from('writing_drafts')
                        .select('content')
                        .eq('writing_id', writingId)
                        .eq('stage', 'prewriting')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    if (planDraft) setPrewritingPlan(planDraft.content)
                }
            }

            // 3. Fetch Latest Content Draft FOR CURRENT STAGE
            const currentStage = writing?.current_stage || 'prewriting'
            console.log(`Fetching draft for WritingID: ${writingId}, Stage: ${currentStage}`)

            let { data: draft, error: fetchError } = await supabase
                .from('writing_drafts')
                .select('*')
                .eq('writing_id', writingId)
                .eq('stage', currentStage)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (fetchError) {
                console.error("Error fetching draft:", fetchError)
            }

            // FALLBACK / SYNC: If Publishing, ALWAYS prioritize Editing content to ensure freshness
            // (Unless we want to allow Publishing-specific edits to persist? 
            //  User request: "Always get latest contents from editing". 
            //  So we should check if Editing is newer or just prefer it.)
            if (currentStage === 'publishing' || currentStage === 'Publishing') {
                console.log("DEBUG: Publishing Stage Init. Fetching Editing draft to sync.")
                const { data: editingDraft } = await supabase
                    .from('writing_drafts')
                    .select('*')
                    .eq('writing_id', writingId)
                    .eq('stage', 'editing')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                // If we found editing content, USE IT.
                // Note: This effectively overwrites any "Publishing" specific changes every load 
                // if they strictly want "latest from editing".
                // However, usually Publishing is read-only layout.
                if (editingDraft && editingDraft.content) {
                    console.log("DEBUG: Syncing Publishing with Editing content.")
                    draft = editingDraft
                    // Update Publishing bucket to match for consistency
                    // (Optional, but good for backup)
                }
            }

            if (draft) {
                console.log("DEBUG: Setting content. Length:", draft.content?.length)
                setContent(draft.content || '')
                lastSavedContentRef.current = draft.content || '' // INFO: Initialize lastSavedContentRef
            } else {
                console.log("DEBUG: No content found anywhere.")
                setContent('')
            }

            // 4. Fetch Agent State (Chat History)
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                const chatRes = await fetch(`${backendUrl}/api/agents/history/${writingId}`)
                if (chatRes.ok) {
                    const chatHistory = await chatRes.json()
                    if (Array.isArray(chatHistory)) {
                        const uiMessages: { role: 'user' | 'assistant', content: string }[] = chatHistory.map((msg: any) => ({
                            role: (msg.role === 'user' ? 'user' : 'assistant'),
                            content: msg.content
                        }))
                        setMessages(uiMessages)
                    }
                }
            } catch (error) {
                console.error("Failed to load chat history:", error)
            } finally {
                setInitializing(false)
            }
        }
        init()
    }, [writingId, router])

    // Initial Agent Check (Once on load)
    useEffect(() => {
        // Only fire ONCE per page load for drafting/revising/editing
        if (!initializing && user && ['drafting', 'revising', 'editing'].includes(stage) && !hasInitialCheckFiredRef.current) {
            hasInitialCheckFiredRef.current = true // Set flag to prevent re-firing
            console.log("Initial Load: Triggering Stage Check (ONE-TIME)...")

            // Allow this specific invocation to bypass the interaction check
            const triggerInitialCheck = async () => {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                // Use a special prompt for "Just Arrived / Loaded Workspace"
                const payload: WritingState = {
                    student_id: user.id,
                    writing_id: writingId as string,
                    grade_level: '3',
                    current_stage: stage,
                    student_text: content,
                    last_prompt: "STAGE_TRANSITION", // Reuse transition logic or new "INITIAL_LOAD"
                    student_response: "[SYSTEM: Student just loaded the workspace. Review the content current content and provide guidance.]",
                    retrieved_standards: [],
                    instructional_gaps: [],
                    messages: messages
                }

                try {
                    const res = await fetch(`${backendUrl}/api/agents/invoke`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                    if (res.ok) {
                        const agentState = await res.json()
                        lastAnalyzedContentRef.current = content // Mark as seen

                        let reply = null
                        if (agentState.messages && agentState.messages.length > 0) {
                            const lastMsg = agentState.messages[agentState.messages.length - 1]
                            if (lastMsg.role === 'ai' || lastMsg.role === 'assistant') {
                                reply = lastMsg.content
                            }
                        }
                        if (reply) {
                            setMessages(prev => [...prev, { role: 'assistant', content: reply }])
                        }
                        if (agentState.instructional_gaps) setGaps(agentState.instructional_gaps)
                        if (agentState.retrieved_standards) setStandards(agentState.retrieved_standards)
                    }
                } catch (e) {
                    console.error("Initial check failed", e)
                }
            }
            triggerInitialCheck()
        }
    }, [initializing]) // Run once when initialization completes


    // Save Content Debounced
    const saveTimerRef = useRef<NodeJS.Timeout>(null)
    const agentTimerRef = useRef<NodeJS.Timeout>(null)
    const contentRef = useRef(content) // Keep track of latest content for interval
    const lastSavedContentRef = useRef(content)
    const lastAnalyzedContentRef = useRef(content) // NEW: Track last content agent saw
    const previousTextRef = useRef<string>('') // Store text from LAST agent turn
    const hasUserInteractedRef = useRef(false) // Track if user has actually typed
    const hasInitialCheckFiredRef = useRef(false) // Prevent repeated initial agent checks

    // Update refs
    useEffect(() => {
        contentRef.current = content
    }, [content])

    // Unified Save Function
    const saveDraft = async (currentContent: string) => {
        if (!user) {
            console.warn("Cannot save: User not authenticated.")
            return
        }

        if (currentContent !== lastSavedContentRef.current) {
            setSaving(true)
            const startTime = Date.now()
            console.log("Attempting save. Content Len:", currentContent.length)

            const payload = {
                writing_id: writingId,
                stage: stage,
                content: currentContent
            }
            try {
                const { error } = await supabase.from('writing_drafts').insert(payload)

                if (error) {
                    console.error("Supabase Save Error:", JSON.stringify(error, null, 2))
                    setSafetyWarning("Failed to save draft! Please copy your work.")
                } else {
                    console.log("Save successful.")
                    lastSavedContentRef.current = currentContent
                    setLastSavedTime(new Date())
                    // Ensure visual feedback lasts at least 800ms
                    const elapsed = Date.now() - startTime
                    if (elapsed < 800) await new Promise(resolve => setTimeout(resolve, 800 - elapsed))
                }
            } catch (err) {
                console.error("Unexpected Save Error:", err)
                setSafetyWarning("Connection error while saving.")
            } finally {
                setSaving(false)
            }
        }
    }


    const handleStageChange = async (newStage: string) => {
        console.log("Changing stage to:", newStage)
        try {
            setLoading(true)
            // 1. SAVE Current Stage Content
            // Before switching, explicitly save the current work to the current stage bucket.
            const { error: saveError } = await supabase.from('writing_drafts').insert({
                writing_id: writingId,
                stage: stage,
                content: content
            })

            if (saveError) {
                console.error("Stage Switch Save Error:", saveError)
                throw new Error("Could not save before switching.")
            }

            // 2. Fetch Latest Content for NEW Stage
            const { data: existingDraft } = await supabase
                .from('writing_drafts')
                .select('*')
                .eq('writing_id', writingId)
                .eq('stage', newStage)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            let nextContent = ''
            let shouldSaveSeededContent = false

            // SPECIAL RULE: Publishing Stage
            // We want Publishing to reflect the "Final" state of the book.
            // 1. If coming FROM Editing, just carry the text over. (No need to fetch, avoid race cond)
            if ((newStage === 'publishing' || newStage === 'Publishing') &&
                (stage === 'editing' || stage === 'Editing')) {
                console.log("Direct transition Editing -> Publishing. carrying content.")
                nextContent = content
                shouldSaveSeededContent = true
            }
            // 2. If coming from elsewhere to Publishing, Try to find Editing content.
            else if (newStage === 'publishing' || newStage === 'Publishing') {
                console.log("Switching to Publishing: Syncing with latest source.")
                // Try Editing -> Revising -> Drafting in order
                const { data: editingDraft } = await supabase
                    .from('writing_drafts')
                    .select('*')
                    .eq('writing_id', writingId)
                    .eq('stage', 'editing')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (editingDraft && editingDraft.content) {
                    nextContent = editingDraft.content
                    shouldSaveSeededContent = true
                } else {
                    // Try Revising
                    const { data: revisingDraft } = await supabase
                        .from('writing_drafts')
                        .select('*')
                        .eq('writing_id', writingId)
                        .eq('stage', 'revising')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    if (revisingDraft && revisingDraft.content) {
                        nextContent = revisingDraft.content
                        shouldSaveSeededContent = true
                    } else {
                        // Fallback to whatever existing publishing draft or current
                        if (existingDraft?.content) nextContent = existingDraft.content
                    }
                }
            }
            // 3. Normal Transition to Other Stages
            else {
                // If fetching 'editing', 'revising', 'drafting'
                const hasMeaningfulContent = existingDraft &&
                    existingDraft.content &&
                    existingDraft.content.replace(/<[^>]+>/g, '').trim().length > 0

                if (hasMeaningfulContent) {
                    console.log("Resuming existing draft.")
                    nextContent = existingDraft.content
                } else {
                    // Start Fresh or Copy Forward
                    shouldSaveSeededContent = true

                    if (newStage === 'drafting' || newStage === 'Drafting') {
                        setPrewritingPlan(content)
                        nextContent = ''
                        shouldSaveSeededContent = false
                    } else if (['revising', 'editing'].includes(newStage)) {
                        nextContent = content
                    } else {
                        nextContent = ''
                        shouldSaveSeededContent = false
                    }
                }
            }

            console.log("Next content length:", nextContent.length)

            // 3. Update State
            setContent(nextContent)
            setStage(newStage)
            // Fix: set lastSavedContentRef to new content to prevent immediate auto-save loop
            lastSavedContentRef.current = nextContent

            // 4. Persist Seeded Content (if applicable)
            if (shouldSaveSeededContent && nextContent) {
                console.log("Seeding storage for new stage:", newStage)
                await supabase.from('writing_drafts').insert({
                    writing_id: writingId,
                    stage: newStage,
                    content: nextContent
                })
            }

            await supabase.from('writings').update({ current_stage: newStage }).eq('id', writingId)

            // Inject Greeting & Notify Check
            const info = STAGE_DEFAULTS[newStage]
            const greeting = info ? info.msg : "Welcome!"

            // Add greeting AND "Checking" status
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: greeting },
                { role: 'assistant', content: "👀 Checking your work..." }
            ])
            if (info) setSuggestions(info.prompts)

            // IMMEDIATE AGENT CHECK FOR NEW STAGE
            if (['drafting', 'revising', 'editing'].includes(newStage)) {
                console.log("Triggering Stage Transition Check...")
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

                const payload: WritingState = {
                    student_id: user?.id || "temp",
                    writing_id: writingId as string,
                    grade_level: '3',
                    current_stage: newStage,
                    student_text: nextContent,
                    last_prompt: "STAGE_TRANSITION",
                    student_response: "[SYSTEM: Student just transitioned to this stage. Review the content and provide stage-appropriate guidance. Provide a concrete and parallel example if valid.]",
                    retrieved_standards: [],
                    instructional_gaps: [],
                    messages: messages
                }

                // Fire and forget (or await? nice to await to stop spinner)
                const res = await fetch(`${backendUrl}/api/agents/invoke`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })

                if (res.ok) {
                    const agentState = await res.json()

                    // Update refs
                    lastAnalyzedContentRef.current = nextContent

                    // Extract reply
                    let reply = null
                    if (agentState.messages && agentState.messages.length > 0) {
                        const lastMsg = agentState.messages[agentState.messages.length - 1]
                        if (lastMsg.role === 'ai' || lastMsg.role === 'assistant') {
                            reply = lastMsg.content
                        }
                    }

                    if (reply) {
                        // Replace the "Checking..." message or append? 
                        // Appending is safer. The "Checking" msg acts as a loader.
                        setMessages(prev => {
                            // Optional: Remove "Check..." if we want, but appending is fine.
                            return [...prev, { role: 'assistant', content: reply }]
                        })
                    }

                    if (agentState.instructional_gaps) setGaps(agentState.instructional_gaps)
                    if (agentState.retrieved_standards) setStandards(agentState.retrieved_standards)
                }
            } else if (newStage === 'prewriting' || newStage === 'Prewriting') {
                // Prewriting might handle its own init via Greeting, or we can invoke IdeaGen?
                // Usually Prewriting is chat-driven. We'll leave it as is for now unless requested.
            }

        } catch (e) {
            console.error("Stage transition failed:", e)
            setSafetyWarning("Failed to change stage. Check console.")
        } finally {
            setLoading(false)
        }
    }

    // Agent Invocation Logic (checking idle)
    const checkAndInvokeAgent = async () => {
        // Only run for specific stages
        if (!['drafting', 'revising', 'editing'].includes(stage)) return

        // CRITICAL: Only invoke if user has ACTUALLY interacted/typed since load
        if (!hasUserInteractedRef.current) {
            console.log("Skipping idle check: No user interaction yet.")
            return
        }

        const currentContent = contentRef.current

        // Ensure we have a valid session before calling backend
        if (!user) return

        // CHECK: Optimization - Skip if content hasn't changed since last check
        if (currentContent === lastAnalyzedContentRef.current) {
            console.log("Skipping idle check: Content unchanged.")
            return
        }

        // Check if content is substantial enough to warrant a check
        if (currentContent.length > 20) {
            console.log("Triggering Idle Coaching Check...")

            // 1. Force Save First
            await saveDraft(currentContent)

            try {
                setLoading(true)
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

                // Construct payload with special system signal
                const payload: WritingState = {
                    student_id: user.id || "temp",
                    writing_id: writingId as string,
                    grade_level: '3', // Should be dynamic
                    current_stage: stage,
                    student_text: currentContent,
                    last_prompt: "PERIODIC_CHECK",
                    student_response: "[SYSTEM: The student has updated the draft and has been idle for 30 seconds. Briefly review the changes and offer a relevant coaching tip or encouragement. Do not be repetitive.]",
                    retrieved_standards: [],
                    instructional_gaps: [],
                    messages: messages // Send current history
                }

                const res = await fetch(`${backendUrl}/api/agents/invoke`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })

                if (res.ok) {
                    // Update the last analyzed ref on success
                    lastAnalyzedContentRef.current = currentContent

                    const agentState = await res.json()
                    // 1. Extract reply
                    let reply = null
                    if (agentState.messages && agentState.messages.length > 0) {
                        const lastMsg = agentState.messages[agentState.messages.length - 1]
                        if (lastMsg.role === 'ai' || lastMsg.role === 'assistant') {
                            reply = lastMsg.content
                        }
                    }

                    // 2. Add ONLY the coach's reply to UI (Proactive)
                    if (reply) {
                        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
                    }

                    // 3. Update gaps/standards if changed
                    if (agentState.instructional_gaps) setGaps(agentState.instructional_gaps)
                    if (agentState.retrieved_standards) setStandards(agentState.retrieved_standards)
                }

            } catch (e) {
                console.error("Periodic check failed", e)
            } finally {
                setLoading(false)
            }
        }
    }


    const handleContentChange = (newContent: string) => {
        hasUserInteractedRef.current = true // User is typing!
        setContent(newContent)

        // 1. Reset Save Timer (5s Debounce)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(async () => {
            await saveDraft(newContent)
        }, 5000)

        // 2. Reset Agent Timer (30s Debounce for Idle)
        if (agentTimerRef.current) clearTimeout(agentTimerRef.current)
        agentTimerRef.current = setTimeout(async () => {
            await checkAndInvokeAgent()
        }, 30000)
    }

    // Agent Invocation
    const handleSendMessage = async (msg: string) => {
        if (!user) return

        // Clear idle timer since user is interacting manually
        if (agentTimerRef.current) clearTimeout(agentTimerRef.current)

        const newMessages = [...messages, { role: 'user' as const, content: msg }]
        setMessages(newMessages)
        setLoading(true)

        try {
            // Update analyzed ref here so idle check doesn't fire immediately after
            lastAnalyzedContentRef.current = content

            // 1. Get Grade Level
            const { data: profile } = await supabase.from('profiles').select('grade_level').eq('id', user.id).single()
            const grade = profile?.grade_level || '3'

            // 2. Prepare Payload
            const payload: WritingState = {
                student_id: user.id,
                writing_id: writingId as string,
                grade_level: grade,
                current_stage: stage,
                student_text: content, // SEND FULL HTML so agent sees formatting (and doesn't strip it if it echoes)
                last_prompt: "user_input",
                student_response: msg,
                retrieved_standards: [],
                instructional_gaps: [],
                messages: newMessages,
                previous_student_text: previousTextRef.current // Send text from LAST turn
            }

            // 3. Call API
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
            const res = await fetch(`${backendUrl}/api/agents/invoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error('Agent API Error')

            const agentState = await res.json()

            let reply = "I'm having trouble thinking right now."
            if (agentState.messages && agentState.messages.length > 0) {
                const lastMsg = agentState.messages[agentState.messages.length - 1]
                if (lastMsg.role === 'ai' || lastMsg.role === 'assistant') {
                    reply = lastMsg.content
                }
            } else if (agentState.active_prompts) {
                reply = JSON.stringify(agentState.active_prompts)
            }

            setMessages([...newMessages, { role: 'assistant', content: reply }])

            // 5. Save State to DB & Update UI
            if (agentState.instructional_gaps) {
                setGaps(agentState.instructional_gaps)
            }
            if (agentState.retrieved_standards) {
                setStandards(agentState.retrieved_standards)
            }

            // 6. Update Content (Canvas) if Agent Modified it
            // CRITICAL FIX: Only allow auto-updates in Prewriting (IdeaGen).
            // In Drafting/Revising/Editing, the user owns the text. We don't want to lose formatting 
            // by overwriting with a plain-text echo from the agent.
            const isPrewriting = stage === 'prewriting' || stage === 'Prewriting'

            console.log("Checking for canvas update. IsPrewriting:", isPrewriting)

            // Only update if Prewriting AND text changed
            if (isPrewriting && agentState.student_text && agentState.student_text !== content) {
                console.log("Updating canvas from agent (Prewriting only)!")
                setContent(agentState.student_text)
                setSafetyWarning("💡 Added to your notes!")
                setTimeout(() => setSafetyWarning(null), 3000)

                await supabase.from('writing_drafts').insert({
                    writing_id: writingId,
                    stage: stage,
                    content: agentState.student_text
                })
            }

            // 7. Update Suggestions (with fallback)
            if (agentState.student_prompts && agentState.student_prompts.length > 0) {
                setSuggestions(agentState.student_prompts)
            } else {
                setSuggestions(STAGE_DEFAULTS[stage]?.prompts || [])
            }

            await supabase.from('instructional_state').insert({
                writing_id: writingId,
                detected_gaps: agentState.instructional_gaps,
                active_prompts: agentState.active_prompts,
                context_summary: "Updated via Chat"
            })

            // 8. Update Previous Text Ref for NEXT turn
            // If backend returned it (meaning it processed it), update our ref
            if (agentState.previous_student_text) {
                previousTextRef.current = agentState.previous_student_text
            } else {
                // Fallback: If backend didn't return it, assume current content is now "previous"
                previousTextRef.current = content
            }

            // Also update Prewriting plan logic from before...


        } catch (err: any) {
            console.error("Full Connection Error:", err)

            let errorMessage = "Error connecting to AI Coach."
            if (err instanceof TypeError && err.message === "Failed to fetch") {
                errorMessage += " Is the backend running on port 8000? Check if uvicorn is active."
            } else {
                errorMessage += " " + (err.message || JSON.stringify(err))
            }

            setMessages([...newMessages, { role: 'assistant', content: errorMessage }])
        } finally {
            setLoading(false)
        }
    }

    // Title Save logic
    const handleTitleBlur = async () => {
        if (!title.trim()) return
        await supabase.from('writings').update({ title: title }).eq('id', writingId)
    }

    if (initializing) return <div className="p-8">Loading Workspace...</div>

    // Deduplicate data before passing to UI
    const uniqueGaps = gaps.filter((gap, index, self) =>
        index === self.findIndex((g) => g.description === gap.description && g.skill_domain === gap.skill_domain)
    )

    const uniqueStandards = standards.filter((std, index, self) =>
        index === self.findIndex((s) => s.content === std.content)
    )

    // Helper to extract quoted text from LLM response for highlighting
    // Looks for text between quotes after "I see you wrote:" or "I noticed you wrote:"
    const extractQuotedTextFromMessages = (): string[] => {
        // Find the latest assistant message
        const assistantMessages = messages.filter(m => m.role === 'assistant')
        if (assistantMessages.length === 0) return []

        const latestMessage = assistantMessages[assistantMessages.length - 1].content

        // Try to find quoted text after "I see you wrote:" or similar patterns
        // Pattern: "I see you wrote: '[quoted text]'" or "I see you wrote: \"[quoted text]\""
        const patterns = [
            /I see you wrote:\s*['"]([^'"]+)['"]/gi,
            /I noticed you wrote:\s*['"]([^'"]+)['"]/gi,
            /In the sentence\s*['"]([^'"]+)['"]/gi,
            /When you wrote\s*['"]([^'"]+)['"]/gi,
            /Where you wrote\s*['"]([^'"]+)['"]/gi,
        ]

        const quotes: string[] = []
        for (const pattern of patterns) {
            let match
            while ((match = pattern.exec(latestMessage)) !== null) {
                if (match[1] && match[1].length > 2) {
                    quotes.push(match[1])
                }
            }
        }

        // Split combined quotes by ", " followed by capital letter and validate each
        const splitAndValidate = (quotes: string[]): string[] => {
            const normalize = (text: string) => text.toLowerCase().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
            const normalizedContent = normalize(content)

            const validQuotes: string[] = []
            for (const quote of quotes) {
                // Split by ", " followed by capital letter (indicates sentence boundary)
                const parts = quote.split(/,\s*(?=[A-Z])/).map(p => p.trim().replace(/^[,.;:\s]+|[,.;:\s]+$/g, '')).filter(p => p.length > 5)
                for (const part of parts) {
                    const normalizedPart = normalize(part)
                    if (normalizedContent.includes(normalizedPart.substring(0, Math.min(normalizedPart.length, 25)))) {
                        validQuotes.push(part)
                        break // Only take the first valid part
                    }
                }
                if (validQuotes.length > 0) break // Only take quotes from first match
            }
            return validQuotes
        }

        return splitAndValidate(quotes)
    }

    // Helper to parse the plan
    const parsePlan = (htmlOrText: string) => {
        const parts = { beginning: '', middle: '', end: '' }
        if (!htmlOrText) return parts

        // Strip HTML tags to get clean text for regex matching
        // (Create a temp context or just use simple regex for stripping since we trust the backend output)
        const text = htmlOrText.replace(/<[^>]*>?/gm, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ') // normalize whitespace
            .trim()

        // Simple regex to find content after 1. Beginning, 2. Middle, 3. End
        // We look for the label, capture everything until the next label or end of string
        const beginningMatch = text.match(/1\.\s*Beginning:?\s*([\s\S]*?)(?=2\.\s*Middle|$)/i)
        const middleMatch = text.match(/2\.\s*Middle:?\s*([\s\S]*?)(?=3\.\s*End|$)/i)
        const endMatch = text.match(/3\.\s*End:?\s*([\s\S]*?)$/i)

        if (beginningMatch) parts.beginning = beginningMatch[1].trim()
        if (middleMatch) parts.middle = middleMatch[1].trim()
        if (endMatch) parts.end = endMatch[1].trim()

        return parts
    }

    const planData = parsePlan(prewritingPlan)
    const hasStructuredPlan = planData.beginning || planData.middle || planData.end

    // Add this import at the top
    // Removed from here

    // ... inside the component, before the final return ...

    // Add conditional return for Publishing Stage
    if (stage === 'publishing' || stage === 'Publishing') {
        return (
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <StageStepper currentStage={stage} onStageClick={handleStageChange} />
                <PublishingWorkspace
                    writingId={writingId as string}
                    title={title}
                    content={content}
                    onUpdateTitle={(newTitle: string) => {
                        setTitle(newTitle)
                        handleTitleBlur() // Auto-save on easy change if desired, or rely on blur
                    }}
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <SafetyToast
                visible={!!safetyWarning}
                message={safetyWarning || ''}
                onClose={() => setSafetyWarning(null)}
            />

            <StageStepper currentStage={stage} onStageClick={handleStageChange} />

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Writing Canvas */}
                <div className="flex-1 p-6 overflow-y-auto bg-muted/10 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <input
                            className="text-3xl font-bold bg-transparent border-none focus:outline-none flex-1"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            placeholder="My Awesome Story Title"
                        />
                        <div className="text-right">
                            <div className="text-sm font-bold text-amber-600 animate-pulse">
                                {saving ? "Saving..." : ""}
                            </div>
                            {lastSavedTime && !saving && (
                                <div className="text-xs text-muted-foreground/60">
                                    Saved {lastSavedTime.toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>

                    {stage === 'drafting' || stage === 'Drafting' ? (
                        // SPLIT SCREEN FOR DRAFTING (SCROLLABLE)
                        <div className="flex flex-col gap-6">
                            {/* TOP PANE: Plan & Helper */}
                            <div className="bg-white/50 rounded-md p-4 border border-dashed border-primary/20 shrink-0">
                                <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-2">Rough Draft Helper</h3>
                                <div className="p-3 bg-yellow-50 rounded text-sm text-muted-foreground border-l-4 border-yellow-300 space-y-3">
                                    <div className="italic mb-2">Don't worry about spelling! Just try to turn your ideas below into sentences.</div>

                                    <div className="grid gap-2">
                                        {hasStructuredPlan ? (
                                            <>
                                                <div className="bg-white/80 p-2 rounded border border-yellow-100">
                                                    <strong className="text-yellow-700 block text-xs uppercase tracking-wide">1. Beginning (Who & Where)</strong>
                                                    <div className="text-foreground/90">{planData.beginning || <span className="text-muted-foreground/50 italic">...</span>}</div>
                                                </div>

                                                <div className="bg-white/80 p-2 rounded border border-yellow-100">
                                                    <strong className="text-yellow-700 block text-xs uppercase tracking-wide">2. Middle (What Happens/Problem)</strong>
                                                    <div className="text-foreground/90">{planData.middle || <span className="text-muted-foreground/50 italic">...</span>}</div>
                                                </div>

                                                <div className="bg-white/80 p-2 rounded border border-yellow-100">
                                                    <strong className="text-yellow-700 block text-xs uppercase tracking-wide">3. End (Resolution)</strong>
                                                    <div className="text-foreground/90">{planData.end || <span className="text-muted-foreground/50 italic">...</span>}</div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-white/80 p-2 rounded border border-yellow-100 min-h-[100px]">
                                                <strong className="text-yellow-700 block text-xs uppercase tracking-wide mb-2">My Ideas</strong>
                                                <div
                                                    className="prose prose-sm max-w-none text-foreground/90 leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>li]:mb-1"
                                                    dangerouslySetInnerHTML={{ __html: prewritingPlan || '<span class="text-muted-foreground/50 italic">No notes yet...</span>' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BOTTOM PANE: Workspace */}
                                <div className="relative bg-white rounded-md shadow-sm min-h-[500px]">
                                    <RichTextEditor
                                        content={content}
                                        onChange={handleContentChange}
                                        placeholder="Start writing your Rough Draft here..."
                                        className="min-h-[500px] border-0 shadow-none rounded-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        // STANDARD LAYOUT (Prewriting, Revising, Editing, Publishing)
                        <RichTextEditor
                            content={content}
                            highlights={(stage === 'revising' || stage === 'editing' || stage === 'Revising' || stage === 'Editing')
                                ? extractQuotedTextFromMessages()
                                : []}
                            onChange={handleContentChange}
                            placeholder={stage === 'prewriting' || stage === 'Prewriting' ? "Chat with PiWrite Coach to add ideas here! ☁️" : "Start writing your story here..."}
                            readOnly={stage === 'prewriting' || stage === 'Prewriting'}
                            className={`h-full min-h-[500px] ${stage === 'prewriting' || stage === 'Prewriting' ? 'bg-muted/20 cursor-default' : ''}`}
                        />
                    )}
                </div>

                {/* Right: AI Coach */}
                <div className="w-[400px] border-l bg-background flex flex-col h-full overflow-hidden">

                    {/* Top 10%: Standards Trigger */}
                    <div className="h-[10%] min-h-[60px] border-b flex items-center justify-center p-2 bg-muted/20">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full h-full text-lg font-semibold border-2 border-dashed border-primary/50 hover:bg-primary/5 hover:border-primary transition-all">
                                    View Gap Analysis & Standards
                                    {uniqueGaps.length > 0 && (
                                        <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                                            {uniqueGaps.length}
                                        </span>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Instructional Gap Analysis</DialogTitle>
                                    <DialogDescription>
                                        Current analysis of your writing against grade-level standards.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4">
                                    <InstructionalGaps gaps={uniqueGaps} standards={uniqueStandards} loading={analyzing} />
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Bottom 90%: Chat Interface */}
                    <div className="h-[90%] relative">
                        <ChatInterface
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            loading={loading}
                            suggestions={suggestions}
                        />
                    </div>
                </div>
            </div>
        </div >
    )
}

