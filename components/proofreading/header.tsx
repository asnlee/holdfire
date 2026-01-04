"use client"

import { Sparkles, Github, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

interface HeaderProps {
  onOpenConfig: () => void,
}

export function Header({ onOpenConfig }: HeaderProps) {  
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">文章校对助手</h1>
              <p className="hidden md:block text-sm text-muted-foreground">AI 驱动的智能文本校对工具</p>
            </div>
          </a>

          <div className="flex items-center gap-4">
            <a href="https://github.com/Asn-Zz/holdfire" target="_blank" title="GitHub">
              <Github className="h-4 w-4" />
            </a>

            <ThemeToggle />

            <Button variant="outline" onClick={onOpenConfig} size="sm">  
              <Settings className="h-4 w-4" />
              <span className="text-xs">配置</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
