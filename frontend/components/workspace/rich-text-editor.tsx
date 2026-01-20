import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Undo, Redo, Highlighter } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
    content: string
    onChange: (html: string) => void
    readOnly?: boolean
    placeholder?: string
    className?: string
    highlights?: string[] // For AI feedback (future implementation: auto-highlight)
}

export function RichTextEditor({
    content,
    onChange,
    readOnly = false,
    placeholder = "Start writing...",
    className,
    highlights
}: RichTextEditorProps) {

    // Use a ref for onChange to avoid stale closures in useEditor without re-initializing it
    const onChangeRef = useRef(onChange)
    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Highlight.configure({ multicolor: true }),
            Placeholder.configure({
                placeholder: placeholder,
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:pointer-events-none',
            }),
        ],
        content: content, // Initial content (note: this is only used on mount if deps are empty)
        editable: !readOnly,
        onUpdate: ({ editor, transaction }) => {
            // Call the latest onChange handler ONLY if it's a local user update
            // AND not a system highlight update
            if (!isRemoteUpdate.current && !transaction.getMeta('isHighlighting')) {
                onChangeRef.current(editor.getHTML())
            }
        },
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none min-h-[300px]",
                    "prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl",
                    "prose-p:leading-relaxed prose-p:my-2",
                    "max-w-none w-full"
                ),
            },
        },
    })

    // Sync content updates from parent (e.g. when switching stages or loading data)
    // Only update if content is significantly different to avoid cursor jumping
    const isRemoteUpdate = useRef(false) // Track if update is from parent

    // Helper to strip highlights for comparison
    const stripHighlights = (html: string) => {
        if (!html) return ""
        return html.replace(/<mark[^>]*>(.*?)<\/mark>/g, '$1')
    }

    useEffect(() => {
        if (!editor) return

        const currentHTML = editor.getHTML()

        // If content is different, update the editor.
        // CHECK: If the only difference is highlights, DO NOT update.
        // This allows us to display highlights (view) without them being in the 'content' (state)
        // and without the state update clobbering the view.
        const cleanContent = stripHighlights(content)
        const cleanCurrent = stripHighlights(currentHTML)

        // Edge case: If we specifically WANT to clear highlights (e.g. content became empty), we might need to force it.
        // But usually content update handles structure. 
        // If content is completely different, we update.

        if (content !== currentHTML) {
            // If they differ, but "clean" versions match, it implies the difference is ONLY highlights.
            // In that case, we validly ignore the update from parent (presuming parent is "clean" and we have "marks").
            // UNLESS we are in a mode where we want to enforce parent state?
            if (cleanContent === cleanCurrent && !readOnly) {
                return
            }

            isRemoteUpdate.current = true // Flag start of remote update

            // Check if it's just a plain text vs HTML mismatch (e.g. initial load of plain text)
            // If the editor is empty and content has stuff, set it.
            if (editor.isEmpty && content) {
                editor.commands.setContent(content)
            }
            // If we are in ReadOnly mode (Prewriting), ALWAYS force update if content changed.
            else if (readOnly) {
                editor.commands.setContent(content)
            }
            // For now, avoid aggressive syncing while typing to prevent loops.
            // But we MUST handle the "Clear draft" case when switching to Drafting.
            else if (!content && !editor.isEmpty) {
                editor.commands.setContent('')
            }
            else {
                // Normal sync (e.g. loading from DB)
                editor.commands.setContent(content)
            }

            // Reset flag immediately after synchronous update (setContent is sync)
            isRemoteUpdate.current = false
        }
    }, [content, editor, readOnly])

    // Update ReadOnly state
    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly)
        }
    }, [readOnly, editor])


    // Apply highlights from AI Feedback
    useEffect(() => {
        if (!editor) return

        const { state, view } = editor
        const { doc } = state
        const tr = state.tr
        const highlightMark = state.schema.marks.highlight

        // 1. Clean up: Remove ALL existing highlights to avoid stale ones
        doc.descendants((node, pos) => {
            if (node.isText) {
                const hasHighlight = node.marks.find(m => m.type.name === 'highlight')
                if (hasHighlight) {
                    tr.removeMark(pos, pos + node.nodeSize, highlightMark)
                }
            }
        })

        // 2. Apply new highlights if any
        if (highlights && highlights.length > 0) {
            highlights.forEach(term => {
                if (!term || term.length < 3) return // Skip very short terms to avoid noise

                doc.descendants((node, pos) => {
                    if (node.isText && node.text) {
                        try {
                            const nodeText = node.text
                            if (!nodeText) return

                            // Escape the term for regex, but allow flexibility in whitespace
                            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                            const regexPattern = escapedTerm.replace(/\s+/g, '\\s+')
                            const regex = new RegExp(regexPattern, 'gi')

                            let match
                            while ((match = regex.exec(nodeText)) !== null) {
                                const from = pos + match.index
                                const to = from + match[0].length

                                tr.addMark(from, to, highlightMark.create())
                            }
                        } catch (e) {
                            console.error("Error highlighting term:", term, e)
                        }
                    }
                })
            })
        }

        // CRITICAL: Tag this transaction so onUpdate knows to ignore it
        // This prevents highlighting from triggering onChange -> LLM invocation
        tr.setMeta('isHighlighting', true)

        // Dispatch the transaction
        if (tr.docChanged) {
            view.dispatch(tr)
        }

    }, [highlights, editor])

    if (!editor) {
        return null
    }

    const ToolbarButton = ({ onClick, isActive, disabled, children, title }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "p-2 rounded hover:bg-muted transition-colors",
                isActive ? "bg-muted text-primary" : "text-muted-foreground",
                disabled ? "opacity-50 cursor-not-allowed" : ""
            )}
            title={title}
        >
            {children}
        </button>
    )

    return (
        <div className={cn("flex flex-col border rounded-md bg-white shadow-sm overflow-hidden", className)}>
            {/* Toolbar */}
            {!readOnly && (
                <div className="flex items-center gap-1 p-1 border-b bg-muted/20 flex-wrap">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </ToolbarButton>

                    <div className="w-px h-6 bg-border mx-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Bullet List"
                    >
                        <List className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Ordered List"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </ToolbarButton>

                    <div className="w-px h-6 bg-border mx-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        isActive={editor.isActive('highlight')}
                        title="Highlight"
                    >
                        <Highlighter className="w-4 h-4" />
                    </ToolbarButton>

                    <div className="flex-1" />

                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().chain().focus().undo().run()}
                        title="Undo"
                    >
                        <Undo className="w-4 h-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().chain().focus().redo().run()}
                        title="Redo"
                    >
                        <Redo className="w-4 h-4" />
                    </ToolbarButton>
                </div>
            )}

            {/* Editor Area */}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto cursor-text" />
        </div>
    )
}
