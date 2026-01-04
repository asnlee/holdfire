"use client"

import { useState, useMemo } from "react"
import type {
  Issue,
  ProofreadingConfig,
  HistoryEntry,
  ThesaurusGroup,
  IssueCategory,
  Correction,
} from "@/types/proofreading"
import { useLocalStorage } from "./use-localStorage"
import fetchSSE from "@/lib/fetchSSE"
import { delay, jsonRepairSafe } from "@/lib/utils"

export const DEFAULT_CONFIG: ProofreadingConfig = {
  apiUrl: process.env.NEXT_PUBLIC_OPENAI_API_URL    || 'https://gen.pollinations.ai/v1/chat/completions',
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY    || '',
  model: process.env.NEXT_PUBLIC_OPENAI_MODEL       || 'openai',
  firecrawlKey: process.env.NEXT_PUBLIC_FIRE_KEY    || '',
  pollinationsKey: process.env.NEXT_PUBLIC_POLL_KEY || '',
  customPrompt: "你是一个专业的文章校对编辑，擅长发现并修正中文语法、拼写错误，同时保持原文风格。",
}

const DEFAULT_THESAURUS: ThesaurusGroup[] = [
  {
    id: "default",
    name: "默认",
    enabled: true,
    corrections: [{ original: "老师", suggestion: "教师" }],
  },
]

const EXAMPLE_TEXT = `太阳徐徐升起，给大地带来了早晨的气息。小名从梦中惊醒，他揉了揉眼睛，发先已经9点了。
他慌张的穿上衣服，拿起手提包就像着学校奔去。路上，他遇到了几个同班同学，他们一个个都在得意的笑着，原来，今天是星期六，没有课。
小明停下了脚本，仔细的想了想，确实，昨天是星期五，所以今天应该没有上课。他懊恼的拍了拍脑袋，自言自语道："我记忆力怎么这么差啊！"
回到家后，妈妈正在做饭。"你去哪了？"妈妈问道。小名有点尴尬的回答"我以为今天有课，差点去学校上课了。"妈妈哈哈大笑，说道："你呀，真是太马虎了，连今天星期几都能记错。"
小明想起上周也发生过类似的一件事情，他把语文老师留的作业给忘记了，结果被老师在全班面前批评，他真的很伤心；
人们常说"书读百变，其义自现。"小明觉的这句话特别有道理。他决定从明天开始，每天写一篇读书笔记，提高自己的阅读理解能力。`

export function useProofreading() {
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [issues, setIssues] = useState<Issue[]>([])
  const [apiError, setApiError] = useState<string | null>(null)
  const [analyze, setAnalyze] = useState<any>({})
  const [controller, setController] = useState<AbortController | null>(null)
  const [config, setConfig] = useLocalStorage<ProofreadingConfig>("config", DEFAULT_CONFIG)
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>("history", [])
  const [thesauruses, setThesauruses] = useLocalStorage<ThesaurusGroup[]>("thesauruses", DEFAULT_THESAURUS)  

  const charCount = useMemo(() => inputText.length, [inputText])

  const saveConfig = (config: ProofreadingConfig) => {
    setConfig(config)
  }

  const resetConfig = () => {
    if (confirm("确定要恢复默认配置吗？")) {
      setConfig(DEFAULT_CONFIG)
    }
  }

  const clearInput = () => {
    setInputText("")
    setIssues([])
    setShowResults(false)
    setApiError(null)
  }

  const loadExample = () => {
    clearInput()
    setInputText(EXAMPLE_TEXT)
  }

  const createPrompt = (text: string) => {
    const enabledCorrections = thesauruses.filter((t) => t.enabled).flatMap((t) => t.corrections)

    const thesaurusText =
      enabledCorrections.length > 0
        ? `\n自定义词库：${enabledCorrections.map((c) => `${c.original} => ${c.suggestion}`).join(", ")}`
        : ""

    return `请分析以下文字片段，找出其中的语法错误、拼写错误、表达优化等问题，并提供修改建议。严格检查所有可能的错误并进行优化。
要求返回一个JSON数组，每个元素包含以下字段：
- "original": 原始文本片段 (必须在原文中精确存在)
- "suggestion": 建议修改后的文本
- "reason": 修改原因的简要说明
- "category": 错误类型，可选值为 '错别字', '语法错误', '标点符号', '表达优化'
请确保:
1. 只返回JSON格式的数据，不要包含任何额外解释或markdown标记。
2. "original" 字段必须是原文中连续且完全匹配的片段。
3. 按照原文顺序返回，保持原文风格不要过度修改。
文本内容：
"""
${text}
"""${thesaurusText}
请直接返回JSON数组, 参考格式：[{...}, ...]`
  }

  const checkText = async () => {
    if (isLoading || !inputText.trim()) return
    if (!config.apiKey || !config.apiUrl) {
      setApiError("请先在配置中设置有效的校对 API URL 和 Key。")
      return
    }

    setIsLoading(true)
    setShowResults(false)
    setIssues([])
    setApiError(null)
    setWordCount(0)
    setController(null)

    try {
      const controller = new AbortController()
      setController(controller)
      const prompt = createPrompt(inputText)
      const payload = { ...config, controller, inputText: prompt, onChunk: (chunk: string) => setWordCount(chunk.length)}
      const { content, analyze: analyzeData } = await fetchSSE(payload)
      setAnalyze(analyzeData)
      
      let [issueIdCounter, currentOffset] = [0, 0]
      const parsedIssues: Issue[] = jsonRepairSafe(content)
      const processedIssues = parsedIssues.map((item) => {
        const start = inputText.indexOf(item.original, currentOffset)
        const issue = {
          ...item,
          id: issueIdCounter++,
          fixed: false,
          start: 0,
          end: 0,
          category: item.category || "语法错误",
          ignored: true,
        }
        if (start !== -1) {
          const end = start + item.original.length
          issue.start = start
          issue.end = end
          issue.ignored = false
          currentOffset = start + 1
        }

        return issue
      })

      setIssues(processedIssues.sort((a, b) => a.start - b.start))
      setShowResults(true)

      // Save to history
      const newEntry: HistoryEntry = {
        text: inputText,
        issues: processedIssues,
        timestamp: new Date().toISOString(),
      }
      const updatedHistory = [newEntry, ...history].slice(0, 10)
      setHistory(updatedHistory)
    } catch (error: any) {
      console.error("校对出错:", error)
      setApiError(error.message || "发生未知错误")
      setShowResults(false)
    } finally {
      setIsLoading(false)
      setController(null)
    }
  }

  const abortCheck = () => {
    controller?.abort()
    setIsLoading(false)
    setWordCount(0)
  }

  const applyFixesToInputText = (fixesToApply: Issue[]) => {
    const sortedFixes = [...fixesToApply].sort((a, b) => b.start - a.start)
    let currentText = inputText

    sortedFixes.forEach((fix) => {
      if (currentText.substring(fix.start, fix.end) === fix.original) {
        currentText = currentText.substring(0, fix.start) + fix.suggestion + currentText.substring(fix.end)
      }
    })

    setInputText(currentText)
    setIssues((prev) => 
      prev.map((issue) => 
        fixesToApply.some((fix) => fix.id === issue.id) ? { ...issue, fixed: true } : issue
      )
    )
  }

  const acceptSuggestion = (id: number) => {
    const issueToFix = issues.find((i) => i.id === id && !i.fixed)
    if (issueToFix) applyFixesToInputText([issueToFix])
  }

  const ignoreSuggestion = (id: number) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ignored: true } : i)))
  }

  const unignoreSuggestion = (id: number) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ignored: false } : i)))
  }

  const fixAllIssues = () => {
    const issuesToFix = issues.filter((i) => !i.fixed && !i.ignored)
    if (issuesToFix.length > 0) applyFixesToInputText(issuesToFix)
  }

  const fixCategoryIssues = (category: IssueCategory | "all") => {
    const issuesToFix = issues.filter((i) => !i.fixed && !i.ignored && (category === "all" || i.category === category))
    if (issuesToFix.length > 0) applyFixesToInputText(issuesToFix)
  }

  const ignoreCategoryIssues = (category: IssueCategory | "all") => {
    setIssues((prev) =>
      prev.map((i) =>
        !i.fixed && !i.ignored && (category === "all" || i.category === category) ? { ...i, ignored: true } : i,
      ),
    )
  }

  const restoreFromHistory = async (entry: HistoryEntry) => {
    setShowResults(false); await delay()
    setInputText(entry.text)
    setIssues(entry.issues)
    setShowResults(true)
    setApiError(null)
  }

  const deleteHistoryEntry = (entry: HistoryEntry) => {
    const updatedHistory = history.filter((h) => h !== entry)
    setHistory(updatedHistory)
  }

  const clearAllHistory = () => {
    if (confirm("确定要清空历史记录吗？")) {
      setHistory([])
    }
  }

  const addThesaurusGroup = (name: string) => {
    const newGroup: ThesaurusGroup = {
      id: Date.now().toString(),
      name,
      enabled: true,
      corrections: [],
    }
    setThesauruses((prev) => [...prev, newGroup])
  }

  const deleteThesaurusGroup = (id: string) => {
    setThesauruses((prev) => prev.filter((g) => g.id !== id))
  }

  const toggleThesaurusGroup = (id: string) => {
    setThesauruses((prev) => prev.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g)))
  }

  const addCorrection = (groupId: string, correction: Correction) => {
    setThesauruses((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, corrections: [...g.corrections, correction] } : g)),
    )
  }

  const deleteCorrection = (groupId: string, original: string) => {
    setThesauruses((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, corrections: g.corrections.filter((c) => c.original !== original) } : g,
      ),
    )
  }

  const editCorrection = (groupId: string, original: string, updatedCorrection: Correction) => {
    setThesauruses((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const updatedCorrections = g.corrections.map((c) => 
            c.original === original ? updatedCorrection : c
          )
          return { ...g, corrections: updatedCorrections }
        }
        return g
      }),
    )
  }

  return {
    inputText,
    setInputText,
    wordCount,
    isLoading,
    showResults,
    issues,
    apiError,
    abortCheck,
    analyze,
    config,
    history,
    thesauruses,
    charCount,
    saveConfig,
    resetConfig,
    clearInput,
    loadExample,
    checkText,
    acceptSuggestion,
    ignoreSuggestion,
    unignoreSuggestion,
    fixAllIssues,
    fixCategoryIssues,
    ignoreCategoryIssues,
    restoreFromHistory,
    deleteHistoryEntry,
    clearAllHistory,
    addThesaurusGroup,
    deleteThesaurusGroup,
    toggleThesaurusGroup,
    addCorrection,
    deleteCorrection,
    editCorrection,
  }
}
