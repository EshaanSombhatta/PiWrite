
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

const STAGES = ['Prewriting', 'Drafting', 'Revising', 'Editing', 'Publishing']

export function StageStepper({ currentStage, onStageClick }: { currentStage: string, onStageClick: (s: string) => void }) {
    const currentIndex = STAGES.findIndex(s => s.toLowerCase() === currentStage.toLowerCase())

    return (
        <div className="w-full py-4 border bg-muted/20" style={{ padding: '50px' }}>
            <div className="container flex justify-between items-center max-w-4xl">
                {STAGES.map((stage, idx) => {
                    const isCompleted = idx < currentIndex
                    const isCurrent = idx === currentIndex

                    return (
                        <div key={stage} className="flex flex-col items-center gap-2 relative">
                            <button
                                onClick={() => onStageClick(stage.toLowerCase())}
                                disabled={idx > currentIndex + 1} // Can only advance one by one or go back
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                                    isCompleted ? "bg-primary text-primary-foreground border-primary" :
                                        isCurrent ? "bg-background border-primary text-primary" : "bg-muted text-muted-foreground border-muted-foreground"
                                )}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                            </button>
                            <span className={cn(
                                "text-xs font-medium capitalize absolute -bottom-6 w-20 text-center",
                                isCurrent ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {stage}
                            </span>

                            {/* Connecting Line */}
                            {idx < STAGES.length - 1 && (
                                <div className={cn(
                                    "absolute left-[50%] top-2 w-[calc(100vw/5-2rem)] md:w-32 h-[2px] -z-10",
                                    idx < currentIndex ? "bg-primary" : "bg-muted"
                                )} style={{ left: '2rem' }} /> // Hacky positioning, handled better with flex
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
