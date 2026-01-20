import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, AlertCircle, Info, BookOpen } from "lucide-react"

interface InstructionalGap {
    skill_domain: string
    description: string
    sol_reference?: string
    severity: 'low' | 'medium' | 'high'
    evidence?: string
}

interface StandardReference {
    content: string
    grade_band?: string
    skill?: string
    source?: string
}

interface InstructionalGapsProps {
    gaps: InstructionalGap[]
    standards?: StandardReference[]
    loading?: boolean
}

export function InstructionalGaps({ gaps, standards, loading }: InstructionalGapsProps) {
    const isEmpty = (!gaps || gaps.length === 0) && (!standards || standards.length === 0)

    if (loading && isEmpty) {
        return (
            <Card className="my-4 border-l-4 border-l-primary/50 shadow-sm animate-pulse">
                <CardHeader className="p-4">
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                </CardHeader>
            </Card>
        )
    }

    if (isEmpty) {
        // Show empty state rather than null, so user knows analysis happened but found nothing
        return (
            <Card className="my-4 border-l-4 border-l-muted shadow-sm bg-muted/20">
                <div className="p-4 flex items-center gap-3 text-muted-foreground">
                    <Info className="h-5 w-5" />
                    <div>
                        <p className="font-medium text-sm">No Specific Gaps Detected</p>
                        <p className="text-xs">Great job! Keep writing.</p>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className="my-4 border-l-4 border-l-primary/50 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
                {/* GAPS SECTION */}
                <AccordionItem value="gaps-list" className="border-b">
                    <AccordionTrigger className="px-4 py-2 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Gap Analysis</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                                {gaps?.length || 0}
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ScrollArea className="h-[300px] w-full px-4 pb-4">
                            <div className="space-y-4 pt-2">
                                {gaps?.map((gap, i) => (
                                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/40 text-sm">
                                        <div className="mt-0.5">
                                            {gap.severity === 'high' ? (
                                                <AlertCircle className="h-4 w-4 text-destructive" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold capitalize text-foreground">
                                                    {gap.skill_domain.replace('_', ' ')}
                                                </span>
                                            </div>

                                            <p className="text-muted-foreground">
                                                {gap.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {(!gaps || gaps.length === 0) && <div className="text-sm text-muted-foreground italic">No gaps detected. Good job!</div>}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>

                {/* STANDARDS SECTION */}
                <AccordionItem value="standards-list" className="border-none">
                    <AccordionTrigger className="px-4 py-2 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Applied Standards</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                                {standards?.length || 0}
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ScrollArea className="h-[200px] w-full px-4 pb-4">
                            <div className="space-y-3 pt-2">
                                {standards?.map((std, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 text-xs border border-blue-100 dark:border-blue-900/20">
                                        <p className="text-foreground/90 font-medium leading-relaxed">
                                            "{std.content}"
                                        </p>
                                        {std.source && (
                                            <div className="mt-1 text-muted-foreground uppercase text-[10px] tracking-wider">
                                                Source: {std.source}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!standards || standards.length === 0) && <div className="text-sm text-muted-foreground italic">No specific standards retrieved yet.</div>}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    )
}
