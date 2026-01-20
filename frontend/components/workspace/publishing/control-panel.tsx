'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Printer, Image as ImageIcon, Sparkles, AlertCircle } from "lucide-react"
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { PageData } from './publishing-workspace'

interface ControlPanelProps {
    pages: PageData[]
    content: string // Added content prop
    onCoverSelect: (url: string) => void
    onPageImageSelect: (pageId: number, url: string) => void
    isGenerating: boolean
    setIsGenerating: (v: boolean) => void
    bookTitle: string
    onExportPDF: () => Promise<void>
}

export function ControlPanel({ pages, content, onCoverSelect, onPageImageSelect, isGenerating, setIsGenerating, bookTitle, onExportPDF }: ControlPanelProps) {
    const [generatedCovers, setGeneratedCovers] = useState<string[]>([])
    const [generatedPageImages, setGeneratedPageImages] = useState<Record<number, string[]>>({})

    const handleGenerateImages = async (prompt: string, count: number, type: 'cover' | 'illustration') => {
        // ...
    }

    const generateImages = async (prompt: string, count: number, type: 'cover' | 'illustration') => {
        setIsGenerating(true)
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
            const res = await fetch(`${backendUrl}/api/images/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, count, type })
            })
            if (!res.ok) throw new Error("Gen Failed")
            const data = await res.json()
            return data.images
        } catch (e) {
            alert("Image generation failed. Is the backend running?")
            return []
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGenerateCovers = async () => {
        // Send rich context for the backend to refine
        const richPrompt = `
        STORY TITLE: ${bookTitle}
        STORY CONTEXT: ${content.substring(0, 1500)}...
        PAGE SCENE TO ILLUSTRATE: The Cover of the book. Create a captivating main image that represents the entire story theme.
        `
        const images = await generateImages(richPrompt, 3, 'cover')
        setGeneratedCovers(images)
    }

    const handleGeneratePageImages = async (pageId: number, textRaw: string) => {
        // Send rich context for the backend to refine
        // We include Title + A chunk of the story (for character context) + The specific page text
        const richPrompt = `
        STORY TITLE: ${bookTitle}
        STORY CONTEXT: ${content.substring(0, 1500)}...
        PAGE SCENE TO ILLUSTRATE: ${textRaw}
        `
        const images = await generateImages(richPrompt, 2, 'illustration')
        setGeneratedPageImages(prev => ({ ...prev, [pageId]: images }))
    }

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b flex items-center justify-between bg-stone-50">
                <h3 className="font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    Creative Studio
                </h3>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-8">

                    {/* SECTION 1: COVER */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Book Cover</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {generatedCovers.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => onCoverSelect(img)}
                                    className="aspect-[3/4] rounded-md overflow-hidden border-2 border-transparent hover:border-purple-500 hover:ring-2 ring-purple-200 transition-all relative bg-slate-100"
                                >
                                    <img
                                        src={img}
                                        className="w-full h-full object-cover"
                                        alt="Generated cover"
                                        loading="eager"
                                        crossOrigin="anonymous"
                                        onError={(e) => {
                                            console.error("Cover load error:", img);
                                            e.currentTarget.style.display = 'none';
                                            const span = document.createElement('span');
                                            span.innerText = 'Error';
                                            span.className = 'text-xs text-red-500 absolute inset-0 flex items-center justify-center';
                                            e.currentTarget.parentElement?.appendChild(span);
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                        <Button
                            onClick={handleGenerateCovers}
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                            Generate Cover Ideas
                        </Button>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* SECTION 2: PAGES */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Page Illustrations</h4>

                        <div className="space-y-4">
                            {pages.map((page) => (
                                <div key={page.id} className="bg-slate-50 p-3 rounded-lg border">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-500">Page {page.id + 1}</span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 text-xs text-purple-600"
                                            onClick={() => handleGeneratePageImages(page.id, page.text)}
                                            disabled={isGenerating}
                                        >
                                            Generate
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-600 line-clamp-2 mb-2 italic">"{page.text.replace(/<[^>]*>/g, '').substring(0, 50)}..."</p>

                                    {generatedPageImages[page.id] && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {generatedPageImages[page.id].map((img, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => onPageImageSelect(page.id, img)}
                                                    className="aspect-square rounded shadow-sm border hover:border-purple-500 overflow-hidden relative bg-slate-100"
                                                >
                                                    <img
                                                        src={img}
                                                        className="w-full h-full object-cover"
                                                        alt="Generated illustration"
                                                        loading="eager"
                                                        crossOrigin="anonymous"
                                                        onError={(e) => {
                                                            console.error("Image load error:", img);
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement?.classList.add('bg-red-50');
                                                            // Add error text
                                                            const span = document.createElement('span');
                                                            span.innerText = 'Error';
                                                            span.className = 'text-xs text-red-500 absolute inset-0 flex items-center justify-center';
                                                            e.currentTarget.parentElement?.appendChild(span);
                                                        }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* FOOTER: Actions */}
            <div className="p-4 border-t bg-stone-50">
                <Button onClick={onExportPDF} className="w-full" variant="secondary" size="lg">
                    <Printer className="w-5 h-5 mr-2" />
                    Print / Download PDF
                </Button>
            </div>
        </div>
    )
}
