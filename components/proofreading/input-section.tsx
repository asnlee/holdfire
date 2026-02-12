"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Copy, Trash2, Lightbulb, Upload, FileText, Eye, Languages, Volume2, Search, BookOpen, Link, MonitorCheckIcon} from "lucide-react"
import { useRef, useState } from "react"
import { parseFile, type ParsedFile } from "@/lib/file-parser"
import { request } from "@/lib/request"
import { FilePreviewCard } from "./file-preview-card"
import { useToast } from "@/hooks/use-toast"
import type { ProofreadingConfig } from "@/types/proofreading"

interface InputSectionProps {
  config: ProofreadingConfig
  inputText: string
  setInputText: (text: string) => void
  wordCount: number
  isLoading: boolean
  onCheck: () => void
  onClear: () => void
  onLoadExample: () => void
  onOpenThesaurus: () => void
  abortCheck: () => void
  charCount: number
}

export function InputSection({
  config,
  inputText,
  setInputText,
  wordCount,
  isLoading,
  onCheck,
  onClear,
  onLoadExample,
  onOpenThesaurus,
  abortCheck,
  charCount,
}: InputSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [loadingAudio, setLoadingAudio] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!inputText.trim()) return
    await navigator.clipboard.writeText(inputText)
    toast({
      title: "已复制",
      description: "文本已复制到剪贴板",
    })
  }

  const maxPreviewLength = 5000
  const placeholder = `在此处粘贴您的文章内容，或者复制链接地址，推荐字符数在${maxPreviewLength}字以内，超过${maxPreviewLength}字将分块处理`
  const validExtensions = ".png,.jpg,.jpeg,.txt,.md,.markdown,.docx,.pdf"
  const validExtensionsList = validExtensions.split(",").map((ext) => ext.slice(1).toUpperCase()).join(" ") 
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileExt = "." + file.name.split(".").pop()?.toLowerCase()    

    if (!validExtensions.includes(fileExt)) {
      toast({
        title: "不支持的文件格式",
        description: `请上传 ${validExtensionsList} 格式的文件`,
        variant: "destructive",
      })
      return
    }

    onClear()
    setIsParsingFile(true)
    setUploadedFile(file.name)

    try {
      const parsed = await parseFile(file, config)
      setParsedFile(parsed)
      setInputText(parsed.text)
      setPreviewOpen(parsed.text.length > maxPreviewLength)
      
      toast({
        title: "文件解析成功",
        description: `已解析 ${parsed.metadata.wordCount} 个字符`,
      })
    } catch (error) {
      console.error("[v0] File parsing error:", error)
      toast({
        title: "文件解析失败",
        description: error instanceof Error ? error.message : "无法解析文件",
        variant: "destructive",
      })
      removeFile()
    } finally {
      setIsParsingFile(false)
    }
  }

  const handleConfirmFile = (text?: string) => {
    if (parsedFile) {
      setInputText(text || parsedFile.text)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setParsedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const urlRegex = /^(https|http):\/\/[^\s/$.?#].[^\s]*$/i;
    const apiKey = config.firecrawlKey || process.env.NEXT_PUBLIC_FIRE_KEY;    
    
    if (urlRegex.test(pastedText) && apiKey) {
      if (window.confirm(`检测到链接，是否要抓取网页内容？\n${pastedText}`)) {
        event.preventDefault();
        setIsParsingFile(true);
        try {
          const body = { url: pastedText, formats: ['markdown'] };
          const url = 'https://api.firecrawl.dev/v1/scrape';
          const res = await request.post<{ data?: Record<string, any>}>(url, body, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          });
          const title = res?.data?.title || 'scraped-content';
          const content = res?.data?.markdown || res?.data?.content || '';
          const file = new File([content], `${title}.md`, { type: 'text/markdown' });
          handleFileUpload({ target: { files: [file] } } as any);
        } catch (error: any) {
          console.error("[v0] Error scraping URL:", error);
        } finally {
          setIsParsingFile(false);
        }
      }
    }
  }

  const handleTransferFile = async (text: string) => {
    setIsParsingFile(true)

    try {
      const prompt = '请将以下文本转换为markdown格式：\n\n' + text
      const response = await fetch(`https://gen.pollinations.ai/text/${prompt}?model=gemini`, {
        headers: {
          'Authorization': `Bearer ${config.pollinationsKey}`,
        }
      });
      const data = await response.text()
      const file = new File([data], `${uploadedFile}.md`, { type: 'text/markdown' });
      handleFileUpload({ target: { files: [file] } } as any);
    } catch (error: any) {
      console.error("[v0] Error transferring file:", error);

      toast({
        title: "文件解析失败",
        description: error instanceof Error ? error.message : "无法解析文件",
        variant: "destructive",
      })
    } finally {
      setIsParsingFile(false);
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection() || '';                                                                   
    const selectedText = selection.toString().trim();
    
    setSelectedText(selectedText)
  }

  const handleVolumeText = async () => {
    try {
      setLoadingAudio(true)
      const text = `文字转语音：${selectedText}`
      const token = config.pollinationsKey || process.env.NEXT_PUBLIC_POLL_KEY
      const response = await fetch(`https://gen.pollinations.ai/text/${text}?model=openai-audio&voice=nova`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })
      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      audio.play()  
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingAudio(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />输入文本
            </span>

            <ul className="flex items-center gap-2 text-xs text-primary">
              <li><Link className="h-3 w-3" /></li>
              <li>
                <a href="https://changfengbox.top/wechat" target="_blank" className="hover:underline">
                  文章下载
                </a>
              </li>
              <li>
                <a href="https://matrix.tencent.com/ai-detect/ai_gen_txt" target="_blank" className="hover:underline">
                  AI率检测
                </a>
              </li>
            </ul>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onMouseUp={handleTextSelection}
              placeholder={placeholder}
              className="min-h-[300px] max-h-[600px] overflow-y-auto resize-none font-sans text-base leading-relaxed"
            />
            <div className="absolute top-0 right-0 flex p-1">
              {selectedText && <Button
                variant="ghost"
                size="icon"
                onClick={handleVolumeText}
                title="播放文本"
                disabled={loadingAudio}
                className={loadingAudio ? 'animate-spin' : ''}
              >
                <Volume2 className="h-4 w-4" />
              </Button>}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                title="复制文本"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">{charCount} 字符</div>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={validExtensions}
              className="hidden"
              onChange={handleFileUpload}
            />
            {!uploadedFile ? (
              <div className="text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p>点击或拖拽文件到此处</p>
                <p className="text-xs mt-1">支持图片、文本、WORD、PDF 格式</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {isParsingFile ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">解析文件中...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm">{uploadedFile}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewOpen(!previewOpen)
                      }}
                      title="预览文件"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile()
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onLoadExample}>
                <Lightbulb className="h-4 w-4" />
                示例
              </Button>
              <Button variant="outline" onClick={onOpenThesaurus}>
                <BookOpen className="h-4 w-4" />
                词库
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isLoading ? 
              <Button variant="ghost" size="sm" onClick={abortCheck} className="text-destructive hover:text-destructive">
                停止
              </Button> : 
              <Button variant="ghost" size="sm" onClick={() => { onClear(); removeFile() }} className="text-destructive hover:text-destructive">
                清空
              </Button>
              }
              <Button onClick={onCheck} disabled={isLoading || !inputText.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    校对中
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    开始校对
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <FilePreviewCard
        open={previewOpen}
        file={parsedFile}
        onConfirm={handleConfirmFile}
        onTransfer={handleTransferFile}
      />

      {isLoading && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MonitorCheckIcon className="h-5 w-5 text-green-500" />
            </div>
            <b>校对结果</b>
          </div>

          <div className="flex items-center justify-center py-15">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            <span className="text-gray-600">正在校对中，{wordCount ? `已完成：${wordCount}` : "请稍候..."}</span>
          </div>
        </div>
      )}
    </>
  )
}
