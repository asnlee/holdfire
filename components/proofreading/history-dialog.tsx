"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { HistoryEntry } from "@/types/proofreading"
import { Trash2 } from "lucide-react"

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  history: HistoryEntry[]
  onRestore: (entry: HistoryEntry) => void
  onDelete: (entry: HistoryEntry) => void
  onClearAll: () => void
}

export function HistoryDialog({ open, onOpenChange, history, onRestore, onDelete, onClearAll }: HistoryDialogProps) {
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("zh-CN")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="mb-1">检查历史 <span className="text-xs text-destructive cursor-pointer" onClick={onClearAll}>(清空全部)</span></DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">查看和恢复之前的校对记录</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="w-full h-[500px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>暂无历史记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    onRestore(entry)
                    onOpenChange(false)
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatDate(entry.timestamp)}</span>
                      <span>字数：{entry.text.length}</span>
                      <span>问题：{entry.issues.filter((i) => !i.ignored).length}</span>
              
                    </div>

                    <div className="flex items-center gap-4">
                      <Trash2 onClick={(e) => { e.stopPropagation(); onDelete(entry) }} className="h-4 w-4 text-destructive hover:text-destructive/80" />
                    </div>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
