import React from 'react'
import { Slider } from "@/components/ui/slider"
import { Type } from 'lucide-react'
import { FONT_OPTIONS } from '@/lib/fonts'

interface StyleControlsProps {
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

export function StyleControls({
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
}: StyleControlsProps) {
    return (
        <div className="bg-white p-4 rounded-lg shadow-md border flex flex-col gap-4 items-start w-full">
            <div className="w-full flex justify-between items-center mb-1 border-b pb-2">
                <span className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                    <Type className="w-4 h-4" /> Cover Styles
                </span>
            </div>

            {/* Font Select */}
            <div className="w-full flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Font Family</span>
                <select
                    className="text-sm border rounded bg-transparent p-1.5 w-full"
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                >
                    {Object.keys(FONT_OPTIONS).map(key => (
                        <option key={key} value={key}>{FONT_OPTIONS[key].name}</option>
                    ))}
                </select>
            </div>

            {/* Title Controls */}
            <div className="w-full space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-700 uppercase bg-slate-100 px-2 py-1 rounded block">Title</span>

                {/* Size & Color */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Size</span>
                    <Slider
                        value={[titleSize]}
                        onValueChange={(v) => setTitleSize(v[0])}
                        min={20} max={100} step={2}
                        className="flex-1"
                    />
                    <input
                        type="color"
                        value={titleColor}
                        onChange={(e) => setTitleColor(e.target.value)}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                        title="Text Color"
                    />
                </div>

                {/* Width */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Width</span>
                    <Slider
                        value={[titleWidth]}
                        onValueChange={(v) => setTitleWidth(v[0])}
                        min={300} max={1000} step={10}
                        className="flex-1"
                    />
                    <span className="text-[10px] text-slate-400 w-6 text-right">{titleWidth}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Height</span>
                    <Slider
                        value={[titleHeight]}
                        onValueChange={(v) => setTitleHeight(v[0])}
                        min={0} max={400} step={10}
                        className="flex-1"
                    />
                    <span className="text-[10px] text-slate-400 w-6 text-right">{titleHeight > 0 ? titleHeight : 'Auto'}</span>
                </div>

                {/* Background */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Bg</span>
                    <Slider
                        value={[titleBgOpacity * 100]}
                        onValueChange={(v) => setTitleBgOpacity(v[0] / 100)}
                        min={0} max={100} step={5}
                        className="flex-1"
                        title="Background Opacity"
                    />
                    <input
                        type="color"
                        value={titleBgColor}
                        onChange={(e) => setTitleBgColor(e.target.value)}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                        title="Background Color"
                    />
                </div>
            </div>

            <div className="h-px bg-slate-100 w-full my-1" />

            {/* Author Controls */}
            <div className="w-full space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase bg-slate-100 px-2 py-1 rounded block">Author</span>

                {/* Size & Color */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Size</span>
                    <Slider
                        value={[authorSize]}
                        onValueChange={(v) => setAuthorSize(v[0])}
                        min={12} max={60} step={2}
                        className="flex-1"
                    />
                    <input
                        type="color"
                        value={authorColor}
                        onChange={(e) => setAuthorColor(e.target.value)}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                        title="Text Color"
                    />
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Height</span>
                    <Slider
                        value={[authorHeight]}
                        onValueChange={(v) => setAuthorHeight(v[0])}
                        min={0} max={300} step={10}
                        className="flex-1"
                    />
                    <span className="text-[10px] text-slate-400 w-6 text-right">{authorHeight > 0 ? authorHeight : 'Auto'}</span>
                </div>

                {/* Background */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground w-12">Bg</span>
                    <Slider
                        value={[authorBgOpacity * 100]}
                        onValueChange={(v) => setAuthorBgOpacity(v[0] / 100)}
                        min={0} max={100} step={5}
                        className="flex-1"
                        title="Background Opacity"
                    />
                    <input
                        type="color"
                        value={authorBgColor}
                        onChange={(e) => setAuthorBgColor(e.target.value)}
                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                        title="Background Color"
                    />
                </div>
            </div>
        </div>
    )
}
