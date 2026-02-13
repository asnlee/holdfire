"use client"

import { useState, useEffect, useRef } from "react"
import type { Issue, IssueCategory } from "@/types/proofreading"
import { Badge } from "@/components/ui/badge"
import { Languages, BookOpen, Search, ChevronLeft, ChevronRight, List } from "lucide-react"
import { TextOutput } from "../different/text-output"
import { DiffItem, generateDiffMarkup, cn } from "@/lib/utils"

import eventBus from "@/lib/eventBus"

interface IssueHighlightProps {
  inputText: string
  issues: Issue[]
  activeCategory: IssueCategory | "all"
  onAcceptSuggestion: (id: number, issue?: Issue) => void
  onIgnoreSuggestion: (id: number) => void
  onShowOriginalByIssueId: (id: number) => void
}

export function IssueHighlight({
  inputText,
  issues,
  activeCategory,
  onAcceptSuggestion,
  onIgnoreSuggestion,
  onShowOriginalByIssueId,
}: IssueHighlightProps) {
  const [segments, setSegments] = useState(() => {
    if (issues.length === 0) return [{ type: "text" as const, content: inputText }]

    const sortedIssues = [...issues].filter(i => i.start || i.end).sort((a, b) => a.start - b.start)
    const segments: Array<{ type: "text" | "highlight"; content: string; issue?: Issue }> = []

    let cursor = 0
    for (const issue of sortedIssues) {
      if (issue.start > cursor) {
        segments.push({ type: "text", content: inputText.substring(cursor, issue.start) })
      }
      segments.push({ type: "highlight", content: inputText.substring(issue.start, issue.end), issue })
      cursor = issue.end
    }

    if (cursor < inputText.length) {
      segments.push({ type: "text", content: inputText.substring(cursor) })
    }

    return segments
  })

  const categoryClassMap = {
    错别字: "highlight-error",
    语法错误: "highlight-warning",
    标点符号: "highlight-suggest",
    表达优化: "highlight-info",
  }
  const getHighlightClass = (issue: Issue) => {
    if (issue.fixed) return "highlight-fixed"
    if (issue.ignored) return "highlight-ignored"
    
    const baseClass = categoryClassMap[issue.category] || "highlight-info"
    const isActive = activeCategory === "all" || activeCategory === issue.category
    
    return cn(baseClass, { "opacity-30": !isActive })
  }

  const resultAreaRef = useRef<HTMLDivElement>(null)
  const [searchPopup, setSearchPopup] = useState<{ visible: boolean; x: number; y: number; text: string } | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleTextSelection = () => {                                                                
    const selection = window.getSelection();                                                                   
    const selectedText = selection?.toString().trim();                                                         
    const resultArea = resultAreaRef.current;
    
    if (selectedText && selection && resultArea) {                                                             
      const range = selection.getRangeAt(0);                                                                 
      const rect = range.getBoundingClientRect();                                                            
      const containerRect = resultArea.getBoundingClientRect();                                             
      setSearchPopup({                                                                                      
        visible: true,                                                                                     
        x: rect.left - containerRect.left + rect.width / 2 - 75, // Adjust for icon size                   
        y: rect.top - containerRect.top - 40, // Position above selection                                  
        text: selectedText,                                                                                
      });                                                                                                    
    } else {                                                                                                   
      setSearchPopup(null);                                                                                  
    }                                                                                                          
  };

  const backIssueList = (issueId: number) => {
    const issueElement = document.querySelector(`[data-issue-id="${issueId}"]`);
    if (issueElement) {
      issueElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const startEditSuggestion = (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIssueId(issue.id);
    setEditValue(issue.suggestion);
  };

  const replaceDelContent = (diff: DiffItem[]) => diff.map(item => {
    return { ...item, content: item.type !== 'del' ? item.content : ' ' }
  })

  const onAccept = (issue: Issue) => {
    const hasEditValue = editingIssueId != null && editingIssueId === issue.id    
    const newIssue = { ...issue, suggestion: hasEditValue ? editValue : issue.suggestion }
    onAcceptSuggestion(issue.id, newIssue)
  }

  useEffect(() => {
    const newSegments = segments.map((segment) => {
      if (segment.type === "text" || !segment.issue) return segment

      const targetIssue = issues.find((item) => item.id === segment.issue?.id)
      if (targetIssue) {
        return { ...segment, content: targetIssue.suggestion, issue: targetIssue }
      }
    })    
    setSegments(newSegments as typeof segments)
  }, [issues]);

  return (
    <>
      <div ref={resultAreaRef} className="flex-1 relative p-6 rounded-lg bg-card border border-border min-h-[200px] whitespace-pre-wrap leading-relaxed md:text-sm" onMouseUp={handleTextSelection}>
        {searchPopup?.visible && (
            <div 
                className='absolute z-10 flex bg-white rounded-lg shadow-lg overflow-hidden' 
                style={{ left: searchPopup.x, top: searchPopup.y }} 
                onMouseDown={(e) => e.preventDefault()}
            >
                <a 
                    href={`https://www.shenyandayi.com/wantWordsResult?query=${encodeURIComponent(searchPopup.text)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-4 py-2 border-r border-gray-100 hover:bg-gray-100"  
                    title="近义词查询"
                >
                    <Languages className="w-4 h-4 text-green-500" /> 
                </a>

                <a 
                    href={`https://cn.bing.com/search?q=${encodeURIComponent(searchPopup.text)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-4 py-2 border-r border-gray-100 hover:bg-gray-100"  
                    title="网页搜索"
                >
                    <Search className="w-4 h-4 text-blue-500" />
                </a>

                <button 
                    onClick={() => eventBus.emit('openThesaurusModal', searchPopup.text)}
                    className="px-4 py-2 hover:bg-gray-100"
                    title="打开词库"
                >
                  <BookOpen className="w-4 h-4 text-blue-500" />
                </button>
            </div>
        )}

        {segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={index}>{segment.content}</span>
          }

          const issue = segment.issue!
          return (
            <span id={`issue-${issue.id}`} key={index} className={`relative group cursor-pointer ${getHighlightClass(issue)}`}>
              {issue.fixed ? segment.content : issue.original}
              {issue.fixed === issue.ignored && (
                <div className="suggestion-popup absolute bottom-full mb-2 left-0 hidden group-hover:block group-active:block z-10 min-w-[250px] max-w-[400px]">
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                    <div className="text-xs font-medium text-destructive mb-1 leading-relaxed">{issue.reason}</div>
                      <div className="text-xs mb-2 space-y-2">
                        {editingIssueId === issue.id ? (
                          <textarea 
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full p-2 border border-border rounded-md text-xs resize-none"
                            rows={3}
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="cursor-pointer hover:opacity-70 text-xs" 
                            onClick={(e) => startEditSuggestion(issue, e)}
                            title="点击修改建议"
                          >
                            <TextOutput className="min-h-[auto] leading-relaxed" diff={replaceDelContent(generateDiffMarkup(issue.suggestion, issue.original))} />
                          </span>
                        )}
                      </div>
                    <div className="flex items-center gap-2">
                      <Badge className="h-6 text-xs" onClick={() => onAccept(issue)}>
                        采纳
                      </Badge>
                      <Badge className="h-6 text-xs" variant="secondary" onClick={() => onIgnoreSuggestion(issue.id)}>
                        忽略
                      </Badge>
                      <Badge className="h-6 text-xs" variant="secondary" title="上一个" onClick={() => onShowOriginalByIssueId(issue.id - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Badge>
                      <Badge className="h-6 text-xs" variant="secondary" title="下一个" onClick={() => onShowOriginalByIssueId(issue.id + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Badge>
                      <Badge className="h-6 text-xs" variant="secondary" title="回到列表" onClick={() => backIssueList(issue.id)}>
                        <List className="w-4 h-4" />
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </span>
          )
        })}
      </div>

      <style>
        {`
        .opacity-30 .suggestion-popup {
          display: none;
        }
        .suggestion-popup:before {
          content: "";
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          height: 10px;
        }
        .suggestion-popup:after {
          content: "";
          position: absolute;
          top: calc(100% - 1px);
          left: 10%;
          border: 6px solid transparent;
          border-top-color: white;
        }
        `}
      </style>
    </>
  )
}