"use client"

import { useMemo, useState } from "react"
import { Languages, Server, Search, ArrowRightLeft, Link, HistoryIcon, Lightbulb, Loader2, Image as ImageIcon, FileText } from "lucide-react"
import { useProofreading } from "@/hooks/use-proofreading"
import { generateDiffMarkup, DiffItem, delay, jsonRepairSafe } from "@/lib/utils"
import { HistoryEntry } from "@/types/proofreading"
import { Header } from "./proofreading/header"
import { Footer } from "./proofreading/footer"
import { ConfigPanel } from "./proofreading/config-panel"
import { HistoryDialog } from "./proofreading/history-dialog"
import { TextInput } from "./different/text-input"
import { TextOutput } from "./different/text-output"
import { ImageInput } from "./different/image-input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DiffAssistant() {
  const proofreading = useProofreading()
  const [showConfig, setShowConfig] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [inputLeft, setInputLeft] = useState('')
  const [inputRight, setInputRight] = useState('')

  const [leftDiff, setLeftDiff] = useState<DiffItem[]>([])
  const [rightDiff, setRightDiff] = useState<DiffItem[]>([])
  const [loading, setLoading] = useState(false)
  
  // Image comparison state
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text')
  const [imageLeft, setImageLeft] = useState<File | null>(null)
  const [imageRight, setImageRight] = useState<File | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [threshold, setThreshold] = useState(0.15)
  const [imageDiffResults, setImageDiffResults] = useState<any[]>([])
  const [imageLeftPreview, setImageLeftPreview] = useState<string | null>(null)
  const [imageRightPreview, setImageRightPreview] = useState<string | null>(null)
  const [imageDiffResult, setImageDiffResult] = useState<string | null>(null)
  const [imageComparisonLoading, setImageComparisonLoading] = useState(false)
  const [imageComparisonError, setImageComparisonError] = useState<string | null>(null)

  const disabled = useMemo(() => inputLeft.length === 0 || inputRight.length === 0, [inputLeft, inputRight])
  const analyze = useMemo(() => ({
    update: rightDiff.filter(item => item.type === 'update').length,
    add: leftDiff.concat(rightDiff).filter(item => item.type === 'add').length,
    result: leftDiff.concat(rightDiff).length,
  }), [leftDiff, rightDiff])
  const similarity = useMemo(() => {    
    const commonTextLength = leftDiff
      .filter(item => item.type === 'text')
      .reduce((sum, item) => sum + item.content.length, 0)
    
    const maxTextLength = Math.max(inputLeft.length, inputRight.length)
    const similarityPercentage = maxTextLength > 0 ? (commonTextLength / maxTextLength) * 100 : 0
    
    return `${similarityPercentage.toFixed(2)}%`
  }, [leftDiff, inputLeft, inputRight])

  const generateDiff = async () => {
    setLoading(true)
    const leftDiff = generateDiffMarkup(inputLeft, inputRight)
    const rightDiff = generateDiffMarkup(inputRight, inputLeft)
    const replaceDelContent = (diff: DiffItem[]) => diff.map(item => {
      if (item.type !== 'del') { return item }
      return { ...item, content: ' ' }
    })

    await delay(500)
    setLeftDiff(replaceDelContent(leftDiff))
    setRightDiff(replaceDelContent(rightDiff))    
    setLoading(false)
  }

  const onLoadExample = () => {
    setInputLeft(`太阳徐徐升起，给大地带来了早晨的气息。小名从梦中惊醒，他揉了揉眼睛，发先已经9点了。
他慌张的穿上衣服，拿起手提包就像着学校奔去。路上，他遇到了几个同班同学，他们一个个都在得意的笑着，原来，今天是星期六，没有课。
小明停下了脚本，仔细的想了想，确实，昨天是星期五，所以今天应该没有上课。他懊恼的拍了拍脑袋，自言自语道："我记忆力怎么这么差啊！"
回到家后，妈妈正在做饭。"你去哪了？"妈妈问道。小名有点心虚的回答"我以为今天有课，差点去学校上课了。"妈妈哈哈大笑，说道："你呀，真是太马虎了，连今天星期几都能记错。"
小明想起上周也发生过类似的一件事情，他把语文老师留的作业给忘记了，结果被老师在全班面前批评，他真的很伤心；
人们常说"书读百变，其义自现。"小明觉的这句话特别有道理。他决定从明天开始，每天写一篇读书笔记，提高自己的阅读理解能力。我是新增的`)
    setInputRight(`太阳徐徐升起，给大地带来了早晨的气息。他揉了揉眼睛，发现已经9点了。
他慌张地穿上衣服，拿起手提包就向着学校奔去。路上，他遇到了几个同班同学，他们一个个都在得意的笑着，原来，今天是星期六，没有课。
小明停下了脚步，仔细地想了想，确实，昨天是星期五，所以今天应该没有上课。他懊恼的拍了拍脑袋，自言自语道："我记忆力怎么这么差啊！"
回到家后，妈妈正在做饭。"你去哪了？"妈妈问道。小明有点尴尬的回答"我以为今天有课，差点去学校上课了。"妈妈哈哈大笑，说道："你呀，真是太马虎了，连今天星期几都能记错。"
小明想起上周也发生过类似的一件事情，他把语文教师留的作业给忘记了，结果被老师在全班面前批评，他真的很伤心。
人们常说"书读百遍，其义自见。"小明觉得这句话特别有道理。他决定从明天开始，每天写一篇读书笔记，提高自己的阅读理解能力。`)
  }

  const restoreFromHistory = (entry: HistoryEntry) => {
    setInputLeft(entry.text)
    const fixedText = entry.issues.reduce((text, issue) => {
      return text.replace(issue.original, issue.suggestion)
    }, entry.text)
    setInputRight(fixedText)

    setLeftDiff([])
    setRightDiff([])
  }

  const onClear = () => {
    window.scrollTo({ top: 0 })
    window.location.reload()
  }

  const onReverse = () => {
    setInputLeft(inputRight)
    setInputRight(inputLeft)
  }

  // Handle image upload and preview
  const handleImageUpload = (file: File, side: 'left' | 'right') => {
    if (!file || !file.type.startsWith('image/')) {
      setImageComparisonError('Please select a valid image file')
      return
    }
    
    const previewUrl = URL.createObjectURL(file)
    
    if (side === 'left') {
      setImageLeft(file)
      setImageLeftPreview(previewUrl)
    } else {
      setImageRight(file)
      setImageRightPreview(previewUrl)
    }
    
    // Clear any previous diff result when a new image is uploaded
    setImageDiffResult(null)
    setImageComparisonError(null)
  }

  // Perform image comparison using pixelmatch
  const compareImages = async () => {
    if (!imageLeft || !imageRight) {
      setImageComparisonError('Please upload both images to compare')
      return
    }

    setImageComparisonLoading(true)
    setImageComparisonError(null)

    try {
      // Dynamically import pixelmatch to avoid server-side rendering issues
      const pixelmatch = (await import('pixelmatch')).default
      
      // Create a promise that resolves when both images are loaded
      const loadImage = (file: File): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file)
          const img = new Image()
          img.onload = () => {
            URL.revokeObjectURL(url) // Clean up the object URL
            resolve(img)
          }
          img.onerror = reject
          img.src = url
        })
      }
      
      // Load both images
      const [i1, i2] = await Promise.all([
        loadImage(imageLeft),
        loadImage(imageRight)
      ])
      
      // Create canvas elements for image data processing
      const canvas1 = document.createElement('canvas')
      const canvas2 = document.createElement('canvas')
      const ctx1 = canvas1.getContext('2d')!
      const ctx2 = canvas2.getContext('2d')!

      // Use the minimum dimensions to ensure we're comparing the same area
      const width = Math.min(i1.width, i2.width)
      const height = Math.min(i1.height, i2.height)
      
      canvas1.width = canvas2.width = width
      canvas1.height = canvas2.height = height

      ctx1.drawImage(i1, 0, 0)
      ctx2.drawImage(i2, 0, 0)

      // Get image data from both canvases
      const img1Data = ctx1.getImageData(0, 0, width, height)
      const img2Data = ctx2.getImageData(0, 0, width, height)
      
      // Create result canvas for diff
      const diffCanvas = document.createElement('canvas')
      diffCanvas.width = width
      diffCanvas.height = height
      const diffCtx = diffCanvas.getContext('2d')!
      const diffData = diffCtx.createImageData(width, height)
      
      // Compare images with pixelmatch
      const pixels = pixelmatch(
        img1Data.data,
        img2Data.data,
        diffData.data,
        width,
        height,
        { threshold, diffColorAlt: [0, 255, 0] }
      )      
      
      // Put the diff data to the canvas
      diffCtx.putImageData(diffData, 0, 0)

      await delay(500)
      
      // Convert the diff canvas to a data URL for display
      const diffDataUrl = diffCanvas.toDataURL()
      setImageDiffResult(diffDataUrl)
      setImageSize({ width, height })
    } catch (error) {
      console.error('Error comparing images:', error)
      setImageComparisonError('Failed to compare images. Please try again.')
    } finally {
      setImageComparisonLoading(false)
    }
  }

  // Handle image input change
  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0], side)
    }
  }

  // Clear image comparison state
  const clearImages = () => {
    if (imageLeftPreview) URL.revokeObjectURL(imageLeftPreview)
    if (imageRightPreview) URL.revokeObjectURL(imageRightPreview)
    
    setImageLeft(null)
    setImageRight(null)
    setImageLeftPreview(null)
    setImageRightPreview(null)
    setImageDiffResult(null)
    setImageComparisonError(null)
  }

  const onLoadImageExample = async () => {
    if (imageComparisonLoading) return
    const examples = ['4a.png', '4b.png']

    try {
      setImageComparisonLoading(true)
      const [res1, res2] = await Promise.all([
        fetch(`/example/${examples[0]}`),
        fetch(`/example/${examples[1]}`)
      ])
      
      const [blob1, blob2] = await Promise.all([res1.blob(), res2.blob()])
      
      const file1 = new File([blob1], examples[0], { type: 'image/png' })
      const file2 = new File([blob2], examples[1], { type: 'image/png' })
      
      handleImageUpload(file1, 'left')
      handleImageUpload(file2, 'right')
    } catch (error) {
      console.error('Error loading example images:', error)
      setImageComparisonError('Failed to load example images. Please try again.')
    } finally {
      setImageComparisonLoading(false)
    }
  }

  const getDiffText = async () => {
    if (loading) return
    try {
      setLoading(true)
      const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proofreading.config.pollinationsKey}`,
        },
        body: JSON.stringify({
          model: 'gemini',
          messages: [{
            role: 'user',
            content: [
              { type: "text", text: `分析 pixelmatch 比对后的图片，局部高亮区域表示两张图片的差异部分(按差异度排序，忽略噪点)，请补充对应文本描述, 要求返回一个JSON数组，每个元素包含以下字段：
- "target": 两张图片的差异部分
- "reason": 该差异部分的简要说明
- "degree": 该差异部分的程度(0-100)
请确保:
1. 只返回JSON格式的数据，不要包含任何额外解释或markdown标记。
2. "target" 字段必须是图片中存在的部分。
3. 使用中文返回。
请直接返回JSON数组, 参考格式：[{...}, ...]` },
              {
                type: 'image_url',
                image_url: { url: imageDiffResult },
              }
            ],
          }],
        }),
      })

      const data = await response.json()
      const text = data.choices[0].message.content
      const parsedText = jsonRepairSafe(text)

      setImageDiffResults(parsedText)
    } catch (error) {
      console.error('Error getting diff text:', error)
      setImageComparisonError('Failed to get diff text. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onOpenConfig={() => setShowConfig(true)} />

      <div className="flex flex-col gap-8 container mx-auto px-4 py-8 max-w-7xl">
        {/* Tab selector */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="w-full justify-start overflow-y-auto bg-muted scrollbar-hide">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              文本比较
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              图片比较
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Text Comparison Tab */}
        {activeTab === 'text' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />输入文本
                </span>
                <a href="https://changfengbox.top/wechat" target="_blank" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  文章下载
                </a>
              </CardTitle>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-start gap-4`}>
              <TextInput config={proofreading.config} inputText={inputLeft} setInputText={setInputLeft} />
              <TextInput config={proofreading.config} inputText={inputRight} setInputText={setInputRight} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onLoadExample}>
                  <Lightbulb className="h-4 w-4" />
                  示例
                </Button>

                <Button variant="outline" onClick={onReverse}>
                  <ArrowRightLeft className="h-4 w-4" />
                  对调
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive">
                  清空
                </Button>
                <Button onClick={generateDiff} disabled={loading || disabled} className="disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  比对文本
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Text Comparison Results */}
        {activeTab === 'text' && leftDiff.length > 0 && <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-end justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-green-500 rotate-90" />比对结果
                </span>

                {analyze.result > 0 && <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>相似度 {similarity}</span>
                  <span className="highlight-warning">更改 {analyze?.update}</span>
                  <span className="highlight-error">不同 {analyze?.add}</span>
                </div>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 max-h-[600px] overflow-y-auto">
              <TextOutput diff={leftDiff} />
              <TextOutput diff={rightDiff} />
            </div>
          </CardContent>
        </Card>}

        {/* Image Comparison Tab */}
        {activeTab === 'image' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />图片比较
                </span>

                <div className="flex items-center gap-2 text-xs">
                  <span>阈值 {threshold}</span>
                  <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image upload section */}
              <div className="flex gap-4">
                <ImageInput
                  imagePreview={imageLeftPreview}
                  image={imageLeft}
                  handleImageInputChange={(e) => handleImageInputChange(e, 'left')}
                />

                <ImageInput
                  imagePreview={imageRightPreview}
                  image={imageRight}
                  handleImageInputChange={(e) => handleImageInputChange(e, 'right')}
                />
              </div>

              {/* Action buttons for image comparison */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={onLoadImageExample}>
                    <Lightbulb className="h-4 w-4" />
                    示例
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearImages} 
                    className="text-destructive hover:text-destructive"
                    disabled={!imageLeft && !imageRight}
                  >
                    清空
                  </Button>
                  <Button 
                    onClick={compareImages} 
                    disabled={imageComparisonLoading || !imageLeft || !imageRight} 
                    className="disabled:opacity-50"
                  >
                    {imageComparisonLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    比对图片
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image comparison result - inside the image tab */}
        {imageComparisonError && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive mt-4">
            {imageComparisonError}
          </div>
        )}

        {activeTab === 'image' && imageDiffResult && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-green-500 rotate-90" />比对结果
                    <span className="flex items-center gap-2 text-xs text-primary cursor-pointer" onClick={getDiffText}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '获取文字版'}
                    </span>
                  </span>

                  <p className="text-sm text-muted-foreground text-center">
                    高亮区域表示图片差异
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {/* Original images - left and right */}
                <div className="hidden md:flex flex-col rounded border">
                  {imageLeftPreview && (
                    <div className="flex flex-col items-center">
                      <img 
                        src={imageLeftPreview} 
                        alt="Original left" 
                        className="mx-auto object-contain"
                        style={{ height: imageSize.height / 2 }}
                      />
                    </div>
                  )}
                  {imageRightPreview && (
                    <div className="flex flex-col items-center">
                      <img 
                        src={imageRightPreview} 
                        alt="Original right" 
                        className="mx-auto object-contain"
                        style={{ height: imageSize.height / 2 }}
                      />
                    </div>
                  )}
                </div>

                {/* Diff result */}
                <img 
                  src={imageDiffResult} 
                  alt="Image comparison result" 
                  className="max-w-full h-auto mx-auto rounded border"
                  style={{ width: imageSize.width, height: imageSize.height }}
                />
              </div>

              {imageDiffResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {imageDiffResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary h-5 w-5 text-xs">
                              {index + 1}
                            </span>
                            {result.target}
                          </h4>
                          <p className="text-muted-foreground text-sm mb-2">
                            {result.reason}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                            程度: {result.degree}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Footer />
      </div>

      <ConfigPanel
        open={showConfig}
        onOpenChange={setShowConfig}
        config={proofreading.config}
        onSave={proofreading.saveConfig}
        onReset={proofreading.resetConfig}
      />

      <HistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        history={proofreading.history}
        onRestore={restoreFromHistory}
        onDelete={proofreading.deleteHistoryEntry}
        onClearAll={proofreading.clearAllHistory}
      />

      {/* Floating History Button */}
      <button
        onClick={() => setShowHistory(true)}
        className="fixed bottom-5 right-4 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        aria-label="查看历史记录"
      >
        <HistoryIcon className="w-4 h-4 mx-auto" />
      </button>
    </div>
  )
}
