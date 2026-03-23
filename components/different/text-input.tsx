import { useState, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseFile } from "@/lib/file-parser"
import { Loader2, Trash2, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ProofreadingConfig } from "@/types/proofreading"

interface InputSectionProps {
    config: ProofreadingConfig
    inputText: string
    setInputText: (text: string) => void
}

export function TextInput({ config, inputText, setInputText }: InputSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadedFile, setUploadedFile] = useState<string | null>(null)
    const [isParsingFile, setIsParsingFile] = useState(false)
    const { toast } = useToast()

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsParsingFile(true)
        setUploadedFile(file.name)

        try {
            const parsed = await parseFile(file, config)
            setInputText(parsed.text)

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

    const removeFile = () => {
        setUploadedFile(null)
        setInputText("")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = event.clipboardData.getData('text')
        const urlRegex = /^(https|http):\/\/[^\s/$.?#].[^\s]*$/i
        
        if (!inputText && urlRegex.test(pastedText)) {
            if (window.confirm(`检测到链接，是否要获取内容？\n${pastedText}`)) {
                event.preventDefault()
                setIsParsingFile(true)
                try {
                    const response = await fetch(pastedText)
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
                    }
                    const blob = await response.blob()
                    const fileName = pastedText.split('/').pop() || ""
                    const file = new File([blob], fileName, { type: blob.type })
                    handleFileUpload({ target: { files: [file] } } as any)
                } catch (error: any) {
                    toast({
                        title: "文件解析失败",
                        description: error instanceof Error ? error.message : "无法解析文件",
                        variant: "destructive",
                    })
                } finally {
                    setIsParsingFile(false)
                }
            }
        }
    }


    return (
        <div className="flex flex-col gap-4">
            <div className="relative">
                <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onPaste={handlePaste}
                    placeholder='请输入文章内容，支持文本链接识别'
                    className="min-h-[400px] max-h-[600px] overflow-y-auto resize-none font-sans text-sm leading-relaxed"
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">{inputText.length} 字符</div>
            </div>

            <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="accept/*"
                    className="hidden"
                    onChange={handleFileUpload}
                />
                {!uploadedFile ? (
                    <div className="text-muted-foreground">
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
        </div>
    )
}