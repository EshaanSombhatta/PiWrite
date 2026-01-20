
'use client'

import { AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function SafetyToast({ message, visible, onClose }: { message: string, visible: boolean, onClose: () => void }) {
    if (!visible) return null;

    return createPortal(
        <div className="fixed top-20 right-4 z-[100] animate-in slide-in-from-right-full fade-in duration-300">
            <Card className="bg-red-50 border-red-200 p-4 flex items-center gap-3 shadow-lg max-w-sm">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <div className="flex-1">
                    <h4 className="font-semibold text-red-900">Let's keep it positive!</h4>
                    <p className="text-sm text-red-700">{message}</p>
                </div>
                <button onClick={onClose} className="text-red-400 hover:text-red-900">×</button>
            </Card>
        </div>,
        document.body
    )
}
