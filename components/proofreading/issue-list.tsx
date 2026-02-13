"use client"

import { useState } from "react"
import type { Issue } from "@/types/proofreading"
import { Badge } from "@/components/ui/badge"
import { Eye, Check, X, Undo2, CheckCircle2, CornerRightDown } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextOutput } from "../different/text-output"
import { DiffItem, generateDiffMarkup } from "@/lib/utils"

interface IssueListProps {
  issues: Issue[]
  onAcceptSuggestion: (id: number, issue?: Issue) => void
  onIgnoreSuggestion: (id: number) => void
  onUnignoreSuggestion: (id: number) => void
  onShowOriginalByIssueId: (id: number) => void
}

const CATEGORY_STYLES = {
  错别字: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
  语法错误: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/20" },
  标点符号: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20" },
  表达优化: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
}

export function IssueList({ 
  issues,
  onAcceptSuggestion,
  onIgnoreSuggestion,
  onUnignoreSuggestion,
  onShowOriginalByIssueId,
}: IssueListProps) {
  const sortedIssues = [...issues].sort((a, b) => {
    if (a.start === 0 && a.end === 0) return 1
    if (b.start === 0 && b.end === 0) return -1
    return a.start - b.start
  })

  const [editValue, setEditValue] = useState("")
  const [editingIssueId, setEditingIssueId] = useState<number | null>(null)
  const replaceDelContent = (diff: DiffItem[]) => diff.map(item => {
    return { ...item, content: item.type !== 'del' ? item.content : ' ' }
  })

  const startEditSuggestion = (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIssueId(issue.id)
    setEditValue(issue.suggestion)
  }

  const onAccept = (issue: Issue) => {
    const hasEditValue = editingIssueId != null && editingIssueId === issue.id
    const newIssue = { ...issue, suggestion: hasEditValue ? editValue : issue.suggestion }
    onAcceptSuggestion(issue.id, newIssue)
  }

  if (sortedIssues.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>暂无问题</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[400px] rounded-lg border border-border">
      <div className="divide-y divide-border">
        {sortedIssues.map((issue) => {
          const style = CATEGORY_STYLES[issue.category] || CATEGORY_STYLES["表达优化"]

          return (
            <div
              key={issue.id}
              data-issue-id={issue.id}
              className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                issue.fixed ? "bg-green-500/5" : issue.ignored ? "bg-muted/30" : ""
              }`}
            >
              <div className="flex flex-col md:flex-row items-start gap-3">
                <Badge variant="outline" className={`${style.bg} ${style.text} ${style.border} border w-[65px]`}>
                  {issue.ignored ? "已忽略" : issue.category}
                </Badge>

                <div className="flex-1 w-full">
                  <p
                    className={`text-sm mb-2 ${issue.fixed || issue.ignored ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    {issue.reason}
                  </p>
                  <div className="flex flex-col text-xs leading-relaxed">
                    <p className="text-xs text-muted-foreground opacity-50 leading-relaxed">
                      {issue.original}
                      {editingIssueId === issue.id && <span title="修改原文" className="cursor-pointer ml-1" onClick={() => setEditValue(issue.original)}><CornerRightDown className="h-3 w-3 text-gray-400 hover:text-gray-600 inline" /></span>}
                    </p>
                    {issue.fixed && <span className="font-medium text-green-500">{issue.suggestion}</span>}
                    {issue.fixed === issue.ignored ? editingIssueId === issue.id 
                      ? <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full p-2 border border-border rounded-md text-xs resize-none" rows={3} autoFocus /> 
                      : <TextOutput className="min-h-[auto]" title="点击修改建议" diff={replaceDelContent(generateDiffMarkup(issue.suggestion, issue.original))} onClick={(e) => startEditSuggestion(issue, e)} /> : null
                    }
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
                  {issue.fixed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : issue.ignored ? (
                    <Badge variant="secondary" className="h-6" onClick={() => onUnignoreSuggestion(issue.id)}>
                      <Undo2 className="h-4 w-4" />撤销
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="default" className="h-6" onClick={() => onAccept(issue)}>
                        <Check className="h-4 w-4" />
                      </Badge>
                      <Badge variant="secondary" className="h-6" onClick={() => onIgnoreSuggestion(issue.id)}>
                        <X className="h-4 w-4" />
                      </Badge>
                      <Badge variant="secondary" className="h-6" onClick={() => onShowOriginalByIssueId(issue.id)}>
                        <Eye className="h-4 w-4" />
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
