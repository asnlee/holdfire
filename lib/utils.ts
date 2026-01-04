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
  type: 'text' | 'add' | 'del' | 'update'
  content: string
}

export function generateDiffMarkup(original: string, polished: string): DiffItem[] {
  const m = original.length;
  const n = polished.length;

  // 阶段 1: 使用动态规划构建 LCS（最长公共子序列）长度表
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === polished[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 阶段 2: 回溯并直接生成分块结果
  const result: DiffItem[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    // 如果两个字符串的当前字符匹配，则它们是公共部分 ('text')
    if (i > 0 && j > 0 && original[i - 1] === polished[j - 1]) {
      const content = original[i - 1];
      // 如果结果数组的最后一个块也是 'text'，则合并
      if (result.length > 0 && result[0].type === 'text') {
        result[0].content = content + result[0].content;
      } else {
        result.unshift({ type: 'text', content });
      }
      i--;
      j--;
    }
    // 如果 polished 字符串的路径更优，意味着 polished 中有一个字符不在 original 中
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      const content = polished[j - 1];
      // 合并连续的 'add' 块
      if (result.length > 0 && result[0].type === 'del') {
        result[0].content = content + result[0].content;
      } else {
        result.unshift({ type: 'del', content });
      }
      j--;
    }
    // 如果 original 字符串的路径更优，意味着 original 中有一个字符不在 polished 中
    else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      const content = original[i - 1];
      // 合并连续的 'del' 块
      if (result.length > 0 && result[0].type === 'add') {
        result[0].content = content + result[0].content;
      } else {
        result.unshift({ type: 'add', content });
      }
      i--;
    }
  }

  return mergeDelAddToUpdates(result);
}

export function mergeDelAddToUpdates(diff: DiffItem[]): DiffItem[] {
  const result: DiffItem[] = [];

  for (let i = 0; i < diff.length; i++) {
    const current = diff[i];

    if (current.type === 'add' && i + 1 < diff.length && diff[i + 1].type === 'del') {
      result.push({
        type: 'update',
        content: current.content
      });
      i++;
    } else {
      result.push(current);
    }
  }

  return result;
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

