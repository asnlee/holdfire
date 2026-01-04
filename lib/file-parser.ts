// File parsing utilities for Word, PDF, and text files

import { fileToBase64 } from "./utils";
import type { ProofreadingConfig } from "@/types/proofreading"

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface ParsedFile {
  text: string
  chapters?: Chapter[];
  metadata: {
    fileName: string
    fileType: string
    pageCount?: number
    wordCount: number
  }
}

/**
 * Parse DOCX files using mammoth
 */
export async function parseDocx(file: File): Promise<ParsedFile> {
  try {
    const mammoth = await import("mammoth")
    const arrayBuffer = await file.arrayBuffer()
    const resultText = await mammoth.extractRawText({ arrayBuffer })
    const resultHtml = await mammoth.convertToHtml({ arrayBuffer })

    const text = resultText.value.replace(/\n+/g, "\n\n");
    const chapters = extractChaptersFromHtml(resultHtml.value);
    
    return {
      text,
      chapters,
      metadata: {
        fileName: file.name,
        fileType: "docx",
        wordCount: text.length,
      },
    }
  } catch (error) {
    console.error("[v0] Error parsing DOCX:", error)
    throw new Error("无法解析 Word 文档，请确保文件格式正确")
  }
}

/**
 * Parse PDF files using pdf-parse
 */
export async function parsePdf(file: File): Promise<ParsedFile> {
  try {
    const { pdfjs: pdfjsLib } = await import("react-pdf")

    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise    

    const pages = []

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.slice(0, -2).map((item: any) => item.str).join(" ")
      
      if (pageText.length > 0) pages.push(pageText)
    }
    
    const text = pages.join("\n\n")
    const outline = await pdf.getOutline()
    const chapters = outline.map((item: any, index: number) => ({
      id: `chapter-${index + 1}`,
      title: item.title,
      content: text,
    }));

    return {
      text,
      chapters,
      metadata: {
        fileName: file.name,
        fileType: "pdf",
        pageCount: pdf.numPages,
        wordCount: text.length,
      },
    }
  } catch (error) {
    console.error("[v0] Error parsing PDF:", error)
    throw new Error("无法解析 PDF 文档，请确保文件格式正确")
  }
}

/**
 * Parse plain text files
 */
export async function parseText(file: File): Promise<ParsedFile> {
  try {
    const text = await file.text().then((text) => text.replace(/\n+/g, "\n\n"))
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
    console.error("[v0] Error parsing text file:", error)
    throw new Error("无法读取文本文件")
  }
}

/**
 * Parse image to text files
 */
export async function parseImage(file: File, config: ProofreadingConfig): Promise<ParsedFile> {
  try {
    const image_url = await fileToBase64(file)
    const token = config.pollinationsKey || process.env.NEXT_PUBLIC_POLL_KEY

    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'gemini',
        messages: [{
          role: 'user',
          content: [
            { type: "text", text: "提取图片中的文字，返回纯文本，不要任何其他信息，公式采用LaTeX格式。" },
            {
              type: 'image_url',
              image_url: { url: image_url },
            }
          ],
        }],
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
    console.error("[v0] Error parsing text file:", error)
    throw new Error("无法读取文本文件")
  }
}

/**
 * Main file parser that routes to appropriate parser based on file type
 */
export async function parseFile(file: File, config: ProofreadingConfig): Promise<ParsedFile> {
  const fileName = file.name.toLowerCase()  

  if (fileName.endsWith(".docx")) {
    return parseDocx(file)
  } else if (fileName.endsWith(".pdf")) {
    return parsePdf(file)
  } else if (file.type.startsWith("text/")) {
    return parseText(file)
  } else if (file.type.startsWith("image/")) {
    return parseImage(file, config)
  } else {
    try {
      return parseText(file)
    } catch (error) {
      throw new Error("不支持的文件格式。请上传图片、TXT、MD、DOCX、PDF 文件")
    }
  }
}

// Function to extract chapters from markdown text content
const extractChapters = (text: string): Chapter[] => {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let currentContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if the line is a markdown heading (starts with #)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Finish the previous chapter if it exists
      if (currentChapter) {
        currentChapter.content = currentContent.trim();
        chapters.push(currentChapter);
      }
      
      // Start a new chapter
      const title = headingMatch[2];
      
      currentChapter = {
        id: `chapter-${chapters.length + 1}`,
        title: title.trim(),
        content: '',
      };
      
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }
  
  // Add the last chapter if it exists
  if (currentChapter) {
    currentChapter.content = currentContent.trim();
    chapters.push(currentChapter);
  } else {
    const maxPreviewLength = 5000
    const chunks = Array.from({ length: Math.ceil(text.length / maxPreviewLength) }, (_, i) => text.slice(i * maxPreviewLength, (i + 1) * maxPreviewLength))
    
    chunks.forEach((chunk, index) => {
      chapters.push({
        id: `chapter-${index + 1}`,
        title: `分块 ${index + 1} (${maxPreviewLength * index}-${maxPreviewLength * (index + 1)})`,
        content: chunk.trim(),
      })
    })
  }
  
  return chapters;
};

/**
 * Extract chapters from HTML content generated by mammoth
 */
function extractChaptersFromHtml(html: string): Chapter[] {
  const chapters: Chapter[] = [];
  const headingMatches = Array.from(html.matchAll(/<h[1-6]>(.*?)<\/h[1-6]>/g));

  for (let i = 0; i < headingMatches.length; i++) {
    const match = headingMatches[i];
    const title = match[1].trim();
    
    // Find the start index of content after the current heading
    const contentStart = match.index! + match[0].length;
    
    // Find the end index of content - either at the next heading or at the end of the string
    const contentEnd = i < headingMatches.length - 1 
      ? headingMatches[i + 1].index 
      : html.length;
    
    const content = html.slice(contentStart, contentEnd).trim();
    
    chapters.push({
      id: `chapter-${chapters.length + 1}`,
      title,
      content,
    });
  }

  return chapters;
}
