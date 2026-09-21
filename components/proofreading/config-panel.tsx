"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { ProofreadingConfig } from "@/types/proofreading"
import { Save, RotateCcw, Lock, Eye, EyeClosed, AlertCircle, HeartCrack, Lightbulb, ImageIcon } from "lucide-react"
import { DEFAULT_CONFIG } from "@/hooks/use-proofreading"
import { useLocalStorage } from "@/hooks/use-localStorage"
import { usePrompt } from "@/components/prompt-provider"
import { defaultRequest } from "@/lib/fetchSSE"

interface ConfigPanelProps {
  authCode?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ProofreadingConfig
  onSave: (config: ProofreadingConfig) => void
  onReset: () => void
}

export function ConfigPanel({ authCode, open, onOpenChange, config, onSave, onReset }: ConfigPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tempConfig, setTempConfig] = useState({ ...config });
  const [keyVisible, setKeyVisible] = useState(false)
  const [availableModels, setAvailableModels] = useLocalStorage<string[]>('availableModels', []);
  const [openReasoningModels, setOpenReasoningModels] = useState<Record<string, { reasoning: boolean; vision?: boolean }>>({});
  const [modelFilterOpen, setModelFilterOpen] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const { showPrompt } = usePrompt();
  const [customPromptVisible, setcustomPromptVisible] = useState(false);
  const [customBodyError, setCustomBodyError] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const TEMPLATE_BODY = `{"enable_thinking": true, "reasoning_effort": "low", "temperature": 0.1}`;

  const handleFillTemplate = () => {
    setTempConfig({ ...tempConfig, customRequestBody: TEMPLATE_BODY });
    setCustomBodyError(null);
  };

  const handleValidateJson = () => {
    if (!tempConfig.customRequestBody.trim()) {
      setCustomBodyError("请求体为空");
      return;
    }
    try {
      JSON.parse(tempConfig.customRequestBody);
      setCustomBodyError(null);
    } catch (e: any) {
      setCustomBodyError(`JSON 格式错误: ${e.message}`);
    }
  };

  const filteredModels = availableModels.filter(m => 
    m.toLowerCase().includes(modelFilter.toLowerCase())
  );

  const fetchOpenAIModels = async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      const [modelUrl] = tempConfig.apiUrl.split('/chat');
      const modelsUrl = modelUrl + '/models';
      const requestUrl = tempConfig.useProxy ? `/api/proxy?url=${encodeURIComponent(modelsUrl)}` : modelsUrl;
      const response = await fetch(requestUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempConfig.apiKey}`,
        },
      }); 

      if (!response.ok) throw new Error('无法获取模型列表');

      const res = await response.json();
      if (res.data) {
        const models = res.data.map((m: Record<string, unknown>) => m.id || m.root || "");
        setAvailableModels(models);
        fetchOpenModels(models);
        if (models.length > 0 && !models.includes(tempConfig.model)) {
          setTempConfig({ ...tempConfig, model: models[0] });
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractModelName = (model: string) => model.split('/').pop()?.toLowerCase() || '';

  const fetchOpenModels = async (models: string[]) => {
    if (!models.length) return;
    try {
      const targetModels = new Set(models.map(extractModelName));
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) throw new Error('无法获取模型列表');

      const res = await response.json();
      if (res.data) {
        const newOpenReasoningModels: Record<string, { reasoning: boolean; vision?: boolean }> = {};
        for (const m of res.data) {
          const name = extractModelName(String(m.id));
          if (!targetModels.has(name)) continue;

          newOpenReasoningModels[name] = {
            reasoning: m.reasoning,
            vision: m.architecture?.input_modalities?.includes('image'),
          };
        }
        setOpenReasoningModels(newOpenReasoningModels);
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    }
  };

  const handleAuthAdmin = async () => {
    if (isLoading) return;
    const code = authCode || await showPrompt("请输入访问密码");
    if (code !== process.env.NEXT_PUBLIC_AUTH_TOKEN) { return }

    setIsLoading(true);
    try {      
      const res = await fetch(process.env.NEXT_PUBLIC_CONFIG_URL || '')
      const data = await res.json()
      setTempConfig(data)
      setAvailableModels([])
      onSave(data)
      onOpenChange(false)
    } catch (error) {
      console.error('获取配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleDetect = async () => {
    if (isLoading) return;
    setDetectError(null);
    setIsLoading(true);
    try {
      const requestUrl = tempConfig.useProxy ? `/api/proxy?url=${encodeURIComponent(tempConfig.apiUrl)}` : tempConfig.apiUrl;
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: tempConfig.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
      }
      await response.json();
      setDetectError('成功');
    } catch (error: any) {
      setDetectError(error.message);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authCode) handleAuthAdmin()
  }, [authCode])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-model-select]')) {
        setModelFilterOpen(false);
      }
    };
    if (modelFilterOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [modelFilterOpen]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>校对配置</DialogTitle>
          <DialogDescription>标准 OpenAI API 格式</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">API URL</Label>
            <div className="flex gap-2">
              <Input
                id="apiUrl"
                className="flex-1"
                value={tempConfig.apiUrl}
                onChange={(e) => setTempConfig({ ...tempConfig, apiUrl: e.target.value })}
                placeholder="https://api.example.com/v1/chat/completions"
              />
              <div className="flex items-center gap-2 bg-muted p-2 rounded-md">
                <Checkbox
                  id="useProxy"
                  checked={tempConfig.useProxy}
                  onCheckedChange={(checked) => setTempConfig({ ...tempConfig, useProxy: checked === true })}
                />
                <Label htmlFor="useProxy">本地代理</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>

            <div className="relative flex gap-2">
              <Input
                id="apiKey"
                type={keyVisible ? "text" : "password"}
                value={tempConfig.apiKey}
                onChange={(e) => setTempConfig({ ...tempConfig, apiKey: e.target.value })}
                placeholder="sk-..."
                className="pr-7"
              />

              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer text-primary" onClick={() => setKeyVisible(!keyVisible)}>
                {keyVisible ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">模型</Label>
            <div className="flex gap-2">
              <div className="relative flex-1" data-model-select>
                <Input
                  id="model"
                  value={tempConfig.model}
                  onChange={(e) => {
                    setTempConfig({ ...tempConfig, model: e.target.value });
                    setModelFilter(e.target.value);
                    setModelFilterOpen(true);
                  }}
                  onFocus={() => availableModels.length > 0 && setModelFilterOpen(true)}
                  placeholder={availableModels.length > 0 ? "输入关键字过滤..." : "gpt-3.5-turbo"}
                />
                {availableModels.length > 0 && modelFilterOpen && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((model) => (
                        <div
                          key={model}
                          className="flex items-center gap-2 cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setTempConfig({ ...tempConfig, model });
                            setModelFilterOpen(false);
                          }}
                        >
                          {model}
                          {openReasoningModels[extractModelName(model)]?.reasoning && <Lightbulb className="inline h-3 w-3" />}
                          {openReasoningModels[extractModelName(model)]?.vision && <ImageIcon className="inline h-3 w-3" />}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">无匹配模型</div>
                    )}
                  </div>
                )}
              </div>
              {tempConfig.apiUrl && tempConfig.apiKey && 
                <Button 
                  onClick={fetchOpenAIModels} 
                  disabled={isLoading}
                  variant="secondary"
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4" />
                  获取列表
                </Button>
              }
            </div>
          </div>

          <div className="space-y-2 grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="flex items-center justify-between" htmlFor="firecrawlKey">
                <span>firecrawl Key</span>
                <a href="https://firecrawl.dev" target="_blank" className="text-xs text-primary">获取链接</a>
              </Label>

              <Input
                id="firecrawlKey"
                type="password"
                value={tempConfig.firecrawlKey}
                onChange={(e) => setTempConfig({ ...tempConfig, firecrawlKey: e.target.value })}
                placeholder="fc-..."
              />

              <p className="text-xs text-muted-foreground">可选，用于解析链接，获取文章内容</p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center justify-between" htmlFor="pollinationsKey">
                <span>huggingface Key</span>
                <a href="https://huggingface.co/settings/tokens" target="_blank" className="text-xs text-primary">获取链接</a>
              </Label>

              <Input
                id="pollinationsKey"
                type="password"
                value={tempConfig.pollinationsKey}
                onChange={(e) => setTempConfig({ ...tempConfig, pollinationsKey: e.target.value })}
                placeholder="xxxx_xxxx"
              />

              <p className="text-xs text-muted-foreground">可选，多模态支持，提供图片、音频、搜索等功能</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center justify-between" htmlFor="customRequestBody">
              <span>自定义请求体</span>
              <span className="text-xs text-primary flex gap-2">
                <span onClick={handleFillTemplate}>填入模版</span>
                <span onClick={handleValidateJson}>验证格式</span>
                <span onClick={() => setcustomPromptVisible(!customPromptVisible)}>{customPromptVisible ? "隐藏" : "展示"}提示词</span>
              </span>
            </Label>
            <Textarea
              id="customRequestBody"
              value={tempConfig.customRequestBody}
              onChange={(e) => {
                setTempConfig({ ...tempConfig, customRequestBody: e.target.value });
                setCustomBodyError(null);
              }}
              placeholder={JSON.stringify(defaultRequest)}
              rows={3}
            />
            {customBodyError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{customBodyError}
              </p>
            )}
          </div>
        </div>

        {customPromptVisible && <div className="space-y-2">
          <Label htmlFor="customPrompt">
            <span>自定义提示词</span>
          </Label>
          <Textarea
            id="customPrompt"
            value={tempConfig.customPrompt}
            onChange={(e) => setTempConfig({ ...tempConfig, customPrompt: e.target.value })}
            placeholder="你是一个专业的文章校对编辑..."
            rows={4}
          />
        </div>}

        <div className="flex justify-between gap-2">
          <Button 
            onClick={handleAuthAdmin}
            variant="secondary"
            disabled={isLoading}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="h-4 w-4" />
            访问密码
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" 
              onClick={() => {
                setTempConfig(DEFAULT_CONFIG)
                onReset()
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleDetect}
              disabled={isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HeartCrack className="h-4 w-4" />
              检测{detectError}
            </Button>
            <Button
              onClick={() => {
                onSave(tempConfig)
                onOpenChange(false)
              }}
              disabled={isLoading}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              保存配置
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
