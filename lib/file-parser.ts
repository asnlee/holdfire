import init, { formatFromExtension, toMarkdownBytes } from "@firecrawl/anydoc-wasm"
import { fileToBase64 } from "./utils"
import type { ProofreadingConfig } from "@/types/proofreading"

let wasmReady = false

async function ensureWasm() {
  if (!wasmReady) {
    await init()
    wasmReady = true
  }
}

export interface Chapter {
  id: string
  title: string
  level?: number
  content: string
}

export interface ParsedFile {
  text: string
  chapters?: Chapter[]
  metadata: {
    fileName: string
    fileType: string
    pageCount?: number
    wordCount: number
  }
}

const ANYDOC_EXTENSIONS = new Set([
  "docx", "doc", "odt", "pdf", "ppt", "pptx",
  "rtf", "epub", "xlsx", "ods", "odp", "csv",
])

/**
 * Parse documents via @firecrawl/anydoc-wasm (DOCX, PDF, DOC, ODT, PPT, PPTX, RTF, EPUB, XLSX, CSV, etc.)
 */
async function parseDocument(file: File): Promise<ParsedFile> {
  try {
    await ensureWasm()

    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const format = formatFromExtension(ext)
    if (!format) throw new Error(`不支持的格式: ${ext}`)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const markdown = toMarkdownBytes(bytes, format)
    const chapters = extractChapters(markdown)

    return {
      text: markdown,
      chapters,
      metadata: {
        fileName: file.name,
        fileType: ext,
        wordCount: markdown.length,
      },
    }
  } catch (error: any) {
    console.error("[file-parser] Error parsing document:", error)

    if (error?.code === "needsOcr") {
      const pages = error.pages?.join(", ") || "未知"
      throw new Error(`PDF 包含扫描页面，需要 OCR 处理 (页面: ${pages})。`)
    }
    if (error?.code === "encrypted") {
      throw new Error("文件已加密，无法解析。请提供未加密的文件。")
    }
    if (error?.code === "malformed") {
      throw new Error("文件格式损坏或无法识别，请检查文件是否完整。")
    }
    throw new Error("无法解析文档，请确保文件格式正确")
  }
}

/**
 * Parse plain text / markdown files
 */
async function parseText(file: File): Promise<ParsedFile> {
  try {
    const text = await file.text().then((t) => t.replace(/\n+/g, "\n\n"))
    const chapters = extractChapters(text)

    return {
      text,
      chapters,
      metadata: {
        fileName: file.name,
        fileType: file.name.split(".").pop()?.toLowerCase() || "txt",
        wordCount: text.length,
      },
    }
  } catch (error) {
    console.error("[file-parser] Error parsing text file:", error)
    throw new Error("无法读取文本文件")
  }
}

/**
 * Parse image to text via Pollinations OCR
 */
async function parseImage(file: File, config: ProofreadingConfig): Promise<ParsedFile> {
  try {
    const image_url = await fileToBase64(file)
    const token = config.pollinationsKey || process.env.NEXT_PUBLIC_POLL_KEY

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3.8-27B',
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "提取图片中的文字，返回纯文本，不要任何其他信息，公式采用LaTeX格式。" },
              {
                type: "image_url",
                image_url: { url: image_url },
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()
    const text = data.choices[0].message.content

    return {
      text,
      metadata: {
        fileName: file.name,
        fileType: file.name.split(".").pop()?.toLowerCase() || "png",
        wordCount: text.length,
      },
    }
  } catch (error) {
    console.error("[file-parser] Error parsing image:", error)
    throw new Error("无法识别图片文字")
  }
}

/**
 * Main file parser — routes to the appropriate parser by file type
 */
export async function parseFile(file: File, config: ProofreadingConfig): Promise<ParsedFile> {
  const ext = file.name.toLowerCase().split(".").pop() || ""

  if (ANYDOC_EXTENSIONS.has(ext)) {
    return parseDocument(file)
  } else if (file.type.startsWith("text/") || ["txt", "md", "markdown"].includes(ext)) {
    return parseText(file)
  } else if (file.type.startsWith("image/")) {
    return parseImage(file, config)
  } else {
    try {
      return parseText(file)
    } catch {
      throw new Error("不支持的文件格式。请上传图片、TXT、MD、DOCX、PDF 等文件")
    }
  }
}

/**
 * Extract chapters from markdown headings
 */
const extractChapters = (text: string): Chapter[] => {
  const lines = text.split("\n")
  const chapters: Chapter[] = []
  let currentChapter: Chapter | null = null
  let currentContent = ""

  chapters.push({
    id: "full-text",
    title: "全文",
    level: 1,
    content: text,
  })

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      if (currentChapter) {
        currentChapter.content = currentContent.trim()
        chapters.push(currentChapter)
      }

      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: "",
      }
      currentContent = ""
    } else {
      currentContent += line + "\n"
    }
  }

  if (currentChapter) {
    currentChapter.content = currentContent.trim()
    chapters.push(currentChapter)
  } else {
    const maxPreviewLength = 5000
    const chunks = Array.from(
      { length: Math.ceil(text.length / maxPreviewLength) },
      (_, i) => text.slice(i * maxPreviewLength, (i + 1) * maxPreviewLength)
    )

    chunks.forEach((chunk, index) => {
      chapters.push({
        id: `chapter-${index + 1}`,
        title: `分块 ${index + 1} (${maxPreviewLength * index}-${maxPreviewLength * (index + 1)})`,
        content: chunk.trim(),
      })
    })
  }

  return chapters
}
