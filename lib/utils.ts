import { clsx, type ClassValue } from 'clsx'
import { jsonrepair } from 'jsonrepair'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fileToBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

export function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exportByBlob(url: string, fileName: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface DiffItem {
  type: 'text' | 'del' | 'update'
  content: string
  original?: string
}

export function generateDiffMarkup(original: string, polished: string): DiffItem[] {
  const m = original.length;
  const n = polished.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = original[i - 1] === polished[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const rawResult: DiffItem[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === polished[j - 1]) {
      rawResult.unshift({ type: 'text', content: original[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawResult.unshift({ type: 'del', content: polished[j - 1] });
      j--;
    } else {
      rawResult.unshift({ type: 'update', content: original[i - 1] });
      i--;
    }
  }

  return rawResult.reduce((acc, item) => {
    const last = acc[acc.length - 1];
    if (item.type === 'del' && last?.type === 'update') return acc;
    if (last?.type === item.type) last.content += item.content;
    else acc.push({ ...item });
    return acc;
  }, [] as DiffItem[]);
}

export function jsonRepairSafe(jsonString = '') {
  const cleanedString = jsonString.replace(/^```json\s*|```$/g, "").trim();
  
  let result: any = [];
  try {
    const repairedString = jsonrepair(cleanedString);
    result = JSON.parse(repairedString);
    if (!Array.isArray(result)) throw new Error("响应不是JSON数组。")
  } catch (error) {
    console.error('JSON repair failed:', error);
  }
  
  return result;
}

