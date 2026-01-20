'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Type } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { PageData } from './publishing-workspace'
import { FONT_OPTIONS } from '@/lib/fonts'

interface BookViewerProps {
    title: string
    author: string
    coverImage: string | null
    pages: PageData[]
    onTitleChange: (v: string) => void
    onAuthorChange: (v: string) => void
    currentPage: number
    onPageChange: (p: number) => void

    // Position Props
    titlePos: { x: number, y: number }
    onTitlePosChange: (pos: { x: number, y: number }) => void
    authorPos: { x: number, y: number }
    onAuthorPosChange: (pos: { x: number, y: number }) => void

    // Appearance Props
    fontName: string
    setFontName: (v: string) => void
    titleSize: number
    setTitleSize: (v: number) => void
    authorSize: number
    setAuthorSize: (v: number) => void
    titleColor: string
    setTitleColor: (v: string) => void
    authorColor: string
    setAuthorColor: (v: string) => void

    // Advanced Props
    titleWidth: number
    setTitleWidth: (v: number) => void
    titleHeight: number
    setTitleHeight: (v: number) => void
    titleBgColor: string
    setTitleBgColor: (v: string) => void
    titleBgOpacity: number
    setTitleBgOpacity: (v: number) => void
    authorHeight: number
    setAuthorHeight: (v: number) => void
    authorBgColor: string
    setAuthorBgColor: (v: string) => void
    authorBgOpacity: number
    setAuthorBgOpacity: (v: number) => void
}

export function BookViewer({
    title, author, coverImage, pages,
    onTitleChange, onAuthorChange,
    currentPage, onPageChange,
    titlePos, onTitlePosChange,
    authorPos, onAuthorPosChange,
    fontName, setFontName,
    titleSize, setTitleSize,
    authorSize, setAuthorSize,
    titleColor, setTitleColor,
    authorColor, setAuthorColor,
    titleWidth, setTitleWidth,
    titleHeight, setTitleHeight,
    titleBgColor, setTitleBgColor,
    titleBgOpacity, setTitleBgOpacity,
    authorHeight, setAuthorHeight,
    authorBgColor, setAuthorBgColor,
    authorBgOpacity, setAuthorBgOpacity
}: BookViewerProps) {
    // Local UI state
    const [editMode, setEditMode] = useState(false)

    // Navigation
    const hasNext = currentPage < pages.length - 1
    const hasPrev = currentPage > -1

    const turnNext = () => hasNext && onPageChange(currentPage + 1)
    const turnPrev = () => hasPrev && onPageChange(currentPage - 1)

    // Derived classes
    const currentFontClass = FONT_OPTIONS[fontName]?.className || ""

    return (
        <div className="relative w-full max-w-4xl aspect-[4/3] perspective-1000">
            {/* Book Case / Background */}
            <div className="absolute inset-0 bg-stone-200 rounded-r-xl shadow-2xl border-l-[12px] border-l-stone-800" id="book-export-root">

                {/* Pages Container */}
                <div className="relative w-full h-full p-8 flex flex-col">


                    {/* EDIT CONTROLS REMOVED (Moved to External Panel) */}

                    {/* CONTENT DISPLAY */}
                    <AnimatePresence mode="wait">
                        {currentPage === -1 ? (
                            <motion.div
                                key="cover"
                                initial={{ opacity: 0, rotateY: -90 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                exit={{ opacity: 0, rotateY: 90 }}
                                transition={{ duration: 0.4 }}
                                className="w-full h-full bg-white shadow-inner rounded-r-lg flex flex-col items-center justify-center p-12 text-center border overflow-hidden relative"
                                style={{ transformOrigin: "left center" }}
                            >
                                {/* Cover Image - Background */}
                                {coverImage && (
                                    <div className="absolute inset-0 z-0">
                                        <img
                                            src={coverImage}
                                            alt="Cover"
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                )}

                                {/* Draggable Title */}
                                <DraggableText
                                    text={title}
                                    onChange={onTitleChange}
                                    pos={titlePos}
                                    onPosChange={onTitlePosChange}
                                    fontClass={currentFontClass}
                                    size={titleSize}
                                    color={titleColor}
                                    width={titleWidth}
                                    height={titleHeight}
                                    bgColor={titleBgColor}
                                    bgOpacity={titleBgOpacity}
                                    initialTop="20%"
                                    initialLeft="50%"
                                    placeholder="Enter Title"
                                />

                                {/* Draggable Author */}
                                <DraggableText
                                    label="Written By"
                                    text={author}
                                    onChange={onAuthorChange}
                                    pos={authorPos}
                                    onPosChange={onAuthorPosChange}
                                    fontClass={currentFontClass}
                                    size={authorSize}
                                    color={authorColor}
                                    bgColor={authorBgColor}
                                    bgOpacity={authorBgOpacity}
                                    // Author doesn't need variable width usually, but we could add it. Default to 400ish
                                    width={400}
                                    height={authorHeight}
                                    initialTop="NaN"
                                    initialBottom="20%"
                                    initialLeft="50%"
                                    placeholder="Author Name"
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key={`page-${currentPage}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full h-full bg-white shadow-inner rounded-r-lg p-10 flex flex-col lg:flex-row gap-8 overflow-hidden relative"
                            >
                                {/* Text Content */}
                                <div className={cn(
                                    "flex-1 text-lg leading-loose font-medium text-slate-800 p-4 border border-transparent hover:border-dashed hover:border-slate-200 rounded overflow-y-auto prose prose-slate max-w-none",
                                    currentFontClass,
                                    "[&>p]:mb-4 [&>br]:block [&>br]:h-2"
                                )}
                                    dangerouslySetInnerHTML={{ __html: pages[currentPage]?.text || "" }}
                                />

                                {/* Page Image */}
                                <div className="w-full lg:w-1/2 h-[50%] lg:h-full bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                                    {pages[currentPage]?.image ? (
                                        <img
                                            src={pages[currentPage].image}
                                            alt="Page Illustration"
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                    ) : (
                                        <div className="text-slate-300 text-center p-4">
                                            <p className="text-4xl mb-2">🎨</p>
                                            <p className="text-sm">No illustration selected</p>
                                            <p className="text-xs mt-2">Use the panel on the right to add one!</p>
                                        </div>
                                    )}
                                </div>

                                {/* Page Number */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-mono">
                                    Page {currentPage + 1}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation Buttons (Outside Book) */}
            <button
                onClick={turnPrev}
                disabled={!hasPrev}
                className="absolute top-1/2 -left-16 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
                <ChevronLeft className="w-8 h-8 text-slate-700" />
            </button>
            <button
                onClick={turnNext}
                disabled={!hasNext}
                className="absolute top-1/2 -right-16 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
                <ChevronRight className="w-8 h-8 text-slate-700" />
            </button>
        </div>
    )
}

// Helper Component for Drag/Edit Logic
function DraggableText({
    label,
    text, onChange,
    pos, onPosChange,
    fontClass, size, color,
    width = 600, // Default width
    height = 0, // Default height (0 = auto)
    bgColor = "#000000",
    bgOpacity = 0,
    initialTop, initialBottom, initialLeft,
    placeholder
}: {
    label?: string
    text: string
    onChange: (v: string) => void
    pos: { x: number, y: number }
    onPosChange: (p: { x: number, y: number }) => void
    fontClass: string
    size: number
    color: string
    width?: number
    height?: number
    bgColor?: string
    bgOpacity?: number
    initialTop?: string
    initialBottom?: string
    initialLeft?: string
    placeholder?: string
}) {
    const [isEditing, setIsEditing] = useState(false)

    // Helper for Hex -> RGB for background
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "0,0,0";
    }

    const rgbaBg = `rgba(${hexToRgb(bgColor)}, ${bgOpacity})`

    // Common style
    const style: React.CSSProperties = {
        top: initialTop,
        bottom: initialBottom,
        left: initialLeft,
    }

    return (
        <motion.div
            drag={!isEditing} // Only draggable when NOT editing
            dragMomentum={false}
            dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
            onDragEnd={(_, info) => {
                onPosChange({
                    x: pos.x + info.offset.x,
                    y: pos.y + info.offset.y
                })
            }}
            animate={{ x: pos.x, y: pos.y }}
            className={cn(
                "absolute z-10 flex flex-col items-center group touch-none",
                !isEditing && "cursor-move hover:scale-[1.01] transition-transform"
            )}
            style={style}
            onDoubleClick={() => setIsEditing(true)}
        >
            <div style={{ transform: "translateX(-50%)" }}>
                {label && (
                    <p className="text-sm text-white/90 mb-1 uppercase tracking-widest text-center shadow-black drop-shadow-md select-none">{label}</p>
                )}

                {isEditing ? (
                    <input
                        autoFocus
                        value={text}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={() => setIsEditing(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                        className={cn(
                            "bg-black/80 border-2 border-white/50 text-center min-w-[300px] focus:outline-none focus:border-white rounded px-2 drop-shadow-lg backdrop-blur-sm",
                            fontClass
                        )}
                        style={{
                            fontSize: `${size}px`,
                            color: color,
                            width: `${width}px`,
                            height: height > 0 ? `${height}px` : 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        placeholder={placeholder}
                    />
                ) : (
                    <div
                        className={cn(
                            "text-center px-4 py-2 border-2 border-transparent hover:border-white/30 rounded transition-colors whitespace-pre-wrap select-none",
                            fontClass
                        )}
                        style={{
                            fontSize: `${size}px`,
                            color: color,
                            textShadow: bgOpacity < 0.2 ? "0 2px 10px rgba(0,0,0,0.5)" : "none",
                            backgroundColor: rgbaBg,
                            width: `${width}px`,
                            height: height > 0 ? `${height}px` : 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {text || <span className="opacity-50 italic">{placeholder}</span>}
                    </div>
                )}

                {!isEditing && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Double-click to edit
                    </div>
                )}
            </div>
        </motion.div>
    )
}
