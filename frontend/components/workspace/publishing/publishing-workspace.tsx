'use client'

import React, { useState, useEffect, useRef } from 'react'
import { BookViewer } from './book-viewer'
import { StyleControls } from './style-controls'
import { ControlPanel } from './control-panel'
// import { PageData } from './publishing-workspace' // Self-import causes issues. Interfaces are exported from here, so no need to import.
import { Button } from "@/components/ui/button"
import { Printer, Share2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { FONT_OPTIONS } from '@/lib/fonts'

interface PublishingWorkspaceProps {
    writingId: string
    title: string
    content: string
    onUpdateTitle: (newTitle: string) => void
}

export interface PageData {
    id: number
    text: string
    image?: string
}

export function PublishingWorkspace({ writingId, title, content, onUpdateTitle }: PublishingWorkspaceProps) {
    const [author, setAuthor] = useState("Student Author")
    const [coverImage, setCoverImage] = useState<string | null>(null)
    const [pages, setPages] = useState<PageData[]>([])
    // New state to hold images loaded from DB separately from text
    const [savedImages, setSavedImages] = useState<Record<number, string>>({})

    const [currentPage, setCurrentPage] = useState(-1) // Lifted State: -1 = Cover

    // Position State for PDF Export
    const [titlePos, setTitlePos] = useState({ x: 0, y: 0 })
    const [authorPos, setAuthorPos] = useState({ x: 0, y: 0 })

    // Formatting State
    const [fontName, setFontName] = useState("Alice")
    const [titleSize, setTitleSize] = useState(32)
    const [authorSize, setAuthorSize] = useState(24)
    const [titleColor, setTitleColor] = useState("#ffffff")
    const [authorColor, setAuthorColor] = useState("#ffffff")

    // New Advanced Styling State
    const [titleWidth, setTitleWidth] = useState(800)
    const [titleBoxHeight, setTitleBoxHeight] = useState(0) // 0 = Auto
    const [titleBgColor, setTitleBgColor] = useState("#000000")
    const [titleBgOpacity, setTitleBgOpacity] = useState(0) // 0 to 1

    // Author State
    const [authorBoxHeight, setAuthorBoxHeight] = useState(0) // 0 = Auto
    const [authorBgColor, setAuthorBgColor] = useState("#000000")
    const [authorBgOpacity, setAuthorBgOpacity] = useState(0) // 0 to 1

    const [isGenerating, setIsGenerating] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Load persisted state (Images & Metadata Only)
    useEffect(() => {
        async function loadBook() {
            try {
                // Get Auth Token
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token

                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                const headers: HeadersInit = {}
                if (token) headers['Authorization'] = `Bearer ${token}`

                const res = await fetch(`${backendUrl}/api/books/${writingId}`, { headers })

                if (res.ok) {
                    const data = await res.json()
                    // If we have saved data
                    if (data && data.pages) {
                        setAuthor(data.author || "Student Author")
                        setCoverImage(data.coverImage || null)
                        // Load saved colors if they exist (backward compatibility: default to white)
                        if (data.titleColor) setTitleColor(data.titleColor)
                        if (data.authorColor) setAuthorColor(data.authorColor)
                        if (data.titleSize) setTitleSize(data.titleSize)
                        if (data.authorSize) setAuthorSize(data.authorSize)
                        if (data.fontName) setFontName(data.fontName)
                        if (data.titlePos) setTitlePos(data.titlePos)
                        if (data.authorPos) setAuthorPos(data.authorPos)

                        // Load new advanced props
                        if (data.titleWidth) setTitleWidth(data.titleWidth)
                        if (data.titleBoxHeight) setTitleBoxHeight(data.titleBoxHeight)
                        if (data.titleBgColor) setTitleBgColor(data.titleBgColor)
                        if (data.titleBgOpacity !== undefined) setTitleBgOpacity(data.titleBgOpacity)

                        if (data.authorBoxHeight) setAuthorBoxHeight(data.authorBoxHeight)
                        if (data.authorBgColor) setAuthorBgColor(data.authorBgColor)
                        if (data.authorBgOpacity !== undefined) setAuthorBgOpacity(data.authorBgOpacity)


                        // Extract images to a map
                        const imgMap: Record<number, string> = {}
                        let hasImages = false
                        if (Array.isArray(data.pages)) {
                            data.pages.forEach((p: any) => {
                                if (p.image) {
                                    imgMap[p.id] = p.image
                                    hasImages = true
                                }
                            })
                        }

                        setSavedImages(imgMap)
                    }
                }
            } catch (e) {
                console.error("Failed to load book", e)
            } finally {
                setIsLoading(false)
            }
        }
        loadBook()

        // Safety timeout
        const safety = setTimeout(() => setIsLoading(false), 5000)
        return () => clearTimeout(safety)
    }, [writingId])

    // Parse content into pages (Smart Pagination) & Merge with Saved Images
    useEffect(() => {
        if (isLoading) return

        let chunks: string[] = []

        // Robust HTML Handling (Preserve formatting)
        const tempDiv = document.createElement("div")
        // We want to keep inline tags (b, i, u, span) but split by blocks.
        // Strategy: 
        // 1. Replace block endings with a special delimiter
        // 2. Split by delimiter
        // 3. Clean up each chunk
        let safeContent = content || ""

        // IMPORTANT: Strip highlight marks from editing stage
        safeContent = safeContent.replace(/<\/?mark[^>]*>/gi, '')

        // Normalize block endings to a delimiter
        const SPLIT_MARKER = "|||PAGE_BREAK|||"
        safeContent = safeContent
            .replace(/<\/p>/gi, `</p>${SPLIT_MARKER}`)
            .replace(/<br\/?>/gi, `<br/>${SPLIT_MARKER}`)
            .replace(/<\/div>/gi, `</div>${SPLIT_MARKER}`)
            .replace(/<\/li>/gi, `</li>${SPLIT_MARKER}`)

        // Split
        let rawChunks = safeContent.split(SPLIT_MARKER)

        // Clean and Filter
        chunks = rawChunks
            .map(c => c.trim())
            .filter(c => c.length > 0 && c !== "<p></p>" && c !== "<br/>")

        // Pagination Logic (Basic Character Count on HTML is risky, but we need some limit)
        // Improved: merge small chunks, split huge ones (stripping tags for length check)
        const PAGE_CHAR_LIMIT = 500 // Increased slightly as HTML adds invisible length

        const finalPages: string[] = []
        let currentPage = ""

        chunks.forEach(chunk => {
            // Check visual length (approx)
            const temp = document.createElement("div")
            temp.innerHTML = currentPage + chunk
            const txtLen = temp.textContent?.length || 0

            if (txtLen > PAGE_CHAR_LIMIT && currentPage.length > 0) {
                // Push current page
                finalPages.push(currentPage)
                currentPage = chunk
            } else {
                currentPage += chunk
            }
        })
        if (currentPage.length > 0) finalPages.push(currentPage)

        if (finalPages.length === 0) finalPages.push("<p>Start writing your story to see pages here!</p>")

        setPages(prevPages => {
            return finalPages.map((html, idx) => {
                const saved = savedImages[idx]
                const existingInSession = prevPages[idx]?.image
                return {
                    id: idx,
                    text: html, // NOW HTML
                    image: existingInSession || saved
                }
            })
        })

    }, [content, isLoading, savedImages])

    // Auto-Save
    useEffect(() => {
        if (isLoading) return

        const timer = setTimeout(async () => {
            const bookData = {
                author,
                coverImage,
                pages,
                // Persist new styles
                titleColor,
                authorColor,
                titleSize,
                authorSize,
                fontName,
                titlePos,
                authorPos,
                // New
                titleWidth,
                titleBoxHeight,
                titleBgColor,
                titleBgOpacity,
                authorBoxHeight,
                authorBgColor,
                authorBgOpacity
            }
            try {
                // Get Auth Token
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token

                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
                const headers: HeadersInit = { 'Content-Type': 'application/json' }
                if (token) headers['Authorization'] = `Bearer ${token}`

                await fetch(`${backendUrl}/api/books/save`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        writing_id: writingId,
                        book_data: bookData
                    })
                })
            } catch (e) {
                console.error("Auto-save failed", e)
            }
        }, 2000)

        return () => clearTimeout(timer)
    }, [author, coverImage, pages, writingId, isLoading, titleColor, authorColor, titleSize, authorSize, fontName, titlePos, authorPos, titleWidth, titleBgColor, titleBgOpacity, authorBgColor, authorBgOpacity])

    const handleCoverSelect = (url: string) => {
        setCoverImage(url)
    }

    const handlePageImageSelect = (pageId: number, url: string) => {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, image: url } : p))
    }

    // Helper to load image for PDF
    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'Anonymous'
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = url
        })
    }

    // Publication Ready Native PDF Export
    const handleExportFullPDF = async () => {
        setIsGenerating(true)
        document.body.style.cursor = 'wait'

        try {
            const pdf = new jsPDF('l', 'mm', 'a4') // Landscape A4: 297x210 mm
            const pageWidth = 297
            const pageHeight = 210

            // Font URLs (Google Fonts Raw)
            const FONT_URLS: Record<string, string> = {
                "Alice": "https://raw.githubusercontent.com/google/fonts/main/ofl/alice/Alice-Regular.ttf",
                "Sniglet": "https://raw.githubusercontent.com/google/fonts/main/ofl/sniglet/Sniglet-Regular.ttf",
                "Montserrat": "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Regular.ttf",
                "Questrial": "https://raw.githubusercontent.com/google/fonts/main/ofl/questrial/Questrial-Regular.ttf",
                "Fredoka": "https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/static/Fredoka-Regular.ttf",
                "Open Sans": "https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/static/OpenSans-Regular.ttf"
            }

            // Helper to load Font
            const loadFont = async (url: string): Promise<string> => {
                const response = await fetch(url)
                const blob = await response.blob()
                return new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        // result is data:font/ttf;base64,.....
                        const base64 = (reader.result as string).split(',')[1]
                        resolve(base64)
                    }
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                })
            }

            // Apply Font Settings
            const fontMeta = FONT_OPTIONS[fontName]
            let pdfFontName = 'helvetica' // default setup

            // Try to load custom font
            if (FONT_URLS[fontName]) {
                try {
                    const fontBase64 = await loadFont(FONT_URLS[fontName])
                    const fileName = `${fontName}-Regular.ttf`

                    pdf.addFileToVFS(fileName, fontBase64)
                    pdf.addFont(fileName, fontName, "normal")
                    pdf.addFont(fileName, fontName, "bold") // Map bold to regular for now to avoid fetching another file

                    pdfFontName = fontName
                    console.log(`Loaded custom font: ${fontName}`)
                } catch (e) {
                    console.error(`Failed to load font ${fontName}, falling back.`, e)
                    // Fallback logic
                    if (fontMeta?.type === 'serif') pdfFontName = 'times'
                    if (fontMeta?.type === 'display') pdfFontName = 'courier'
                }
            } else {
                if (fontMeta?.type === 'serif') pdfFontName = 'times'
                if (fontMeta?.type === 'display') pdfFontName = 'courier'
            }

            // --- 1. COVER PAGE ---
            if (coverImage) {
                try {
                    const img = await loadImage(coverImage)
                    // Full bleed cover
                    pdf.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight)
                } catch (e) {
                    console.error("Failed to load cover", e)
                }
            } else {
                // Fallback background
                pdf.setFillColor(240, 240, 240)
                pdf.rect(0, 0, pageWidth, pageHeight, 'F')
            }

            // --- Helper to hex to rgb ---
            const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 0, g: 0, b: 0 };
            }

            // Approximate conversion: 1px screen drag ~= 0.26mm
            // Default Title Pos: Top 20% (42mm), Left 50% (148.5mm)
            const mmPerPx = 0.26458

            // --- Title ---
            pdf.setFont(pdfFontName, "bold")
            pdf.setFontSize(titleSize)

            const titleX = (pageWidth / 2) + (titlePos.x * mmPerPx)
            const titleY = (pageHeight * 0.20) + (titlePos.y * mmPerPx)

            // Background for Title
            if (titleBgOpacity > 0) {
                const { w, h } = pdf.getTextDimensions(title, { fontSize: titleSize })
                const boxW = titleWidth * mmPerPx // explicit width in mm
                // If boxW is much smaller than w, we rely on PDF wrapping which is tricky with simple text()
                // Ideally we use splitTextToSize if we want wrapping

                // Simpler: Draw box centered around titleY/X
                // Text is drawn centered, so box should be too
                // Padding
                const pad = 4

                // We will define the box based on the adjustable width
                const rectW = boxW
                // Estimate height (lines)
                const lines = pdf.splitTextToSize(title, rectW)
                const rectH = (lines.length * titleSize * 0.3527) + (pad * 2) // approx height mm

                const rgb = hexToRgb(titleBgColor)

                // Set Transparency
                try {
                    pdf.saveGraphicsState()
                    pdf.setGState(new (pdf as any).GState({ opacity: titleBgOpacity }))
                    pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                    // Center rect
                    pdf.rect(titleX - (rectW / 2), titleY - (titleSize * 0.3527) - pad, rectW, rectH, 'F')
                    pdf.restoreGraphicsState()
                } catch (e) {
                    console.warn("GState transparency not supported or failed", e)
                }
            }

            // Draw Title Text
            pdf.setTextColor(titleColor)
            // We use split text to respect the width roughly
            const titleLines = pdf.splitTextToSize(title, titleWidth * mmPerPx)
            pdf.text(titleLines, titleX, titleY, { align: 'center' })

            // --- Author ---
            pdf.setFontSize(16)
            pdf.setTextColor(authorColor) // Reset just in case, though usually manual

            const authorX = (pageWidth / 2) + (authorPos.x * mmPerPx)
            const authorY = (pageHeight * 0.80) + (authorPos.y * mmPerPx) // Bottom 20%

            // Background for Author
            if (authorBgOpacity > 0) {
                const pad = 4
                // Author box width is smaller, maybe fixed or proportional
                const rectW = 400 * mmPerPx

                const rgb = hexToRgb(authorBgColor)

                try {
                    pdf.saveGraphicsState()
                    pdf.setGState(new (pdf as any).GState({ opacity: authorBgOpacity }))
                    pdf.setFillColor(rgb.r, rgb.g, rgb.b)
                    // Center rect (Author block creates ~2 lines height: 'Written By' + Name)
                    // Height approx: 16pt label + authorSize name
                    const hEst = ((16 + authorSize) * 0.3527) + (pad * 3)

                    // Draw rect slightly offset up to cover 'Written By' as well
                    pdf.rect(authorX - (rectW / 2), authorY - 14, rectW, hEst, 'F')
                    pdf.restoreGraphicsState()
                } catch (e) {
                    console.warn("GState failed", e)
                }
            }

            // Draw Author Text
            pdf.setFontSize(16)
            pdf.text(`Written By`, authorX, authorY - 10, { align: 'center' })
            pdf.setFontSize(authorSize)
            pdf.text(author, authorX, authorY, { align: 'center' })


            // --- 2. STORY PAGES ---
            for (let i = 0; i < pages.length; i++) {
                pdf.addPage()
                const page = pages[i]

                // Text Area
                pdf.setTextColor(0, 0, 0)
                pdf.setFont(pdfFontName, "normal")
                pdf.setFontSize(14)

                // Convert HTML to formatted text for PDF (preserving structure)
                const tempDiv = document.createElement("div")
                tempDiv.innerHTML = page.text

                // Process HTML to preserve structure:
                // 1. Replace <br> with newlines
                // 2. Add double newline after </p> for paragraph spacing
                // 3. Then extract text
                let processedHtml = page.text
                    .replace(/<br\s*\/?>/gi, '\n') // <br> -> newline
                    .replace(/<\/p>/gi, '</p>\n\n') // </p> -> paragraph break
                    .replace(/<\/div>/gi, '</div>\n') // </div> -> newline
                    .replace(/<\/li>/gi, '</li>\n') // </li> -> newline for list items
                    .replace(/<li[^>]*>/gi, '• ') // <li> -> bullet point

                tempDiv.innerHTML = processedHtml
                const formattedText = (tempDiv.textContent || tempDiv.innerText || "")
                    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines to max 2
                    .trim()

                const textLines = pdf.splitTextToSize(formattedText, 120) // 120mm width
                pdf.text(textLines, 15, 30) // x=15mm, y=30mm

                // Image Area
                if (page.image) {
                    try {
                        const img = await loadImage(page.image)
                        // Fit image in right half box: 130x130mm approx
                        pdf.addImage(img, 'PNG', 150, 20, 130, 130)
                    } catch (e) {
                        pdf.setDrawColor(200)
                        pdf.rect(150, 20, 130, 130)
                        pdf.text("Image not available", 180, 80)
                    }
                }

                // Page Number
                pdf.setFontSize(10)
                pdf.setTextColor(150)
                pdf.text(`Page ${i + 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
            }

            pdf.save(`${title.replace(/\s+/g, '_')}_Storybook_HQ.pdf`)

        } catch (e) {
            console.error("PDF Export Failed", e)
            alert("Could not export PDF. Please check console.")
        } finally {
            setIsGenerating(false)
            document.body.style.cursor = 'default'
        }
    }

    if (isLoading) return <div className="p-8">Loading Book...</div>

    return (
        <div className="flex h-full overflow-hidden bg-stone-100">
            {/* Left Sidebar: Style Controls (Only visible on Cover) */}
            {currentPage === -1 && (
                <div className="w-80 h-full bg-white border-r shadow-sm overflow-y-auto p-4 z-20 shrink-0">
                    <StyleControls
                        fontName={fontName} setFontName={setFontName}
                        titleSize={titleSize} setTitleSize={setTitleSize}
                        authorSize={authorSize} setAuthorSize={setAuthorSize}
                        titleColor={titleColor} setTitleColor={setTitleColor}
                        authorColor={authorColor} setAuthorColor={setAuthorColor}
                        titleWidth={titleWidth} setTitleWidth={setTitleWidth}
                        titleHeight={titleBoxHeight} setTitleHeight={setTitleBoxHeight}
                        titleBgColor={titleBgColor} setTitleBgColor={setTitleBgColor}
                        titleBgOpacity={titleBgOpacity} setTitleBgOpacity={setTitleBgOpacity}
                        authorHeight={authorBoxHeight} setAuthorHeight={setAuthorBoxHeight}
                        authorBgColor={authorBgColor} setAuthorBgColor={setAuthorBgColor}
                        authorBgOpacity={authorBgOpacity} setAuthorBgOpacity={setAuthorBgOpacity}
                    />
                </div>
            )}

            {/* Main Area: Book Preview */}
            <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center relative">
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                    {/* Extra tools if needed */}
                </div>

                <div id="book-export-root" className="p-4 bg-transparent w-full flex justify-center items-center">
                    <BookViewer
                        title={title}
                        author={author}
                        coverImage={coverImage}
                        pages={pages}
                        onTitleChange={onUpdateTitle}
                        onAuthorChange={setAuthor}
                        // Passed State
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        titlePos={titlePos}
                        onTitlePosChange={setTitlePos}
                        authorPos={authorPos}
                        onAuthorPosChange={setAuthorPos}
                        // Appearance
                        fontName={fontName}
                        setFontName={setFontName}
                        titleSize={titleSize}
                        setTitleSize={setTitleSize}
                        authorSize={authorSize}
                        setAuthorSize={setAuthorSize}
                        titleColor={titleColor}
                        setTitleColor={setTitleColor}
                        authorColor={authorColor}
                        setAuthorColor={setAuthorColor}
                        // Advanced
                        titleWidth={titleWidth}
                        setTitleWidth={setTitleWidth}
                        titleHeight={titleBoxHeight} // Pass height
                        setTitleHeight={setTitleBoxHeight}
                        titleBgColor={titleBgColor}
                        setTitleBgColor={setTitleBgColor}
                        titleBgOpacity={titleBgOpacity}
                        setTitleBgOpacity={setTitleBgOpacity}
                        authorHeight={authorBoxHeight} // Pass height
                        setAuthorHeight={setAuthorBoxHeight}
                        authorBgColor={authorBgColor}
                        setAuthorBgColor={setAuthorBgColor}
                        authorBgOpacity={authorBgOpacity}
                        setAuthorBgOpacity={setAuthorBgOpacity}
                    />
                </div>
            </div>

            {/* Right Sidebar: Controls */}
            <div className="w-[400px] border-l bg-background shadow-xl z-20 overflow-y-auto">
                <ControlPanel
                    pages={pages}
                    content={content}
                    onCoverSelect={handleCoverSelect}
                    onPageImageSelect={handlePageImageSelect}
                    isGenerating={isGenerating}
                    setIsGenerating={setIsGenerating}
                    bookTitle={title}
                    // Pass export handler
                    onExportPDF={handleExportFullPDF}
                />
            </div>
        </div>
    )
}
