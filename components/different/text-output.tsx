import { DiffItem } from "@/lib/utils"

interface TextOutputProps {
    diff: DiffItem[]
    className?: string
    onClick?: (e: React.MouseEvent) => void
    title?: string
}

export function TextOutput({ diff, ...props }: TextOutputProps) {    
    const getHighlightClass = (item: DiffItem) => {
        const keyMap = {
            update: "highlight-warning",
            del: "highlight-error",
        }
        return keyMap[item.type as keyof typeof keyMap] || ""
    }
      
    return (
        <div className="flex-1 relative px-3 py-2 rounded-lg bg-card border border-border min-h-[200px] whitespace-pre-wrap leading-relaxed text-sm" {...props}>
            {diff.map((item, index) => (
                <span key={index} className={getHighlightClass(item)}>{item.content}</span>
            ))}
        </div>
    )
}