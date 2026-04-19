# 自定义Hooks模块 (src/hooks/)

> P2 | 音频与语音能力封装 · 可复用状态逻辑

## 模块概述

封装浏览器音频API和Web Speech API，提供响应式Hooks供组件使用。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `useAudioRecorder.ts` | Hook | `useAudioRecorder()` | StudioPage.tsx | 音频录制Hook，支持PCM16编码、WAV导出 |
| `useSpeechRecognition.ts` | Hook | `useSpeechRecognition(lang)` | App.tsx | 语音识别Hook，基于Web Speech API |

## useAudioRecorder

### 返回值

```typescript
{
  isSupported: boolean;  // 是否支持音频录制
  isRecording: boolean;  // 是否正在录制
  audioFile: File | null; // 录制完成的音频文件
  setAudioFile: (file: File | null) => void; // 设置外部音频文件
  start: () => Promise<void>; // 开始录制
  stop: () => void; // 停止录制
}
```

### 技术细节

- 使用 `AudioContext` + `ScriptProcessor` 捕获音频流
- 实时降采样到16kHz PCM16格式
- 停止时自动编码为WAV文件
- 支持外部音频文件输入(用于上传文件转写)

## useSpeechRecognition

### 返回值

```typescript
{
  isSupported: boolean;     // 是否支持语音识别
  isListening: boolean;     // 是否正在监听
  transcript: string;       // 最终识别文本
  interimTranscript: string; // 临时识别文本
  setTranscript: (text: string) => void; // 设置识别文本
  start: () => void;        // 开始识别
  stop: () => void;         // 停止识别
  reset: () => void;        // 重置识别状态
}
```

### 技术细节

- 基于浏览器 `SpeechRecognition` / `webkitSpeechRecognition` API
- 支持连续识别和中间结果
- 语言通过参数配置 (zh-CN / en-US)
- 自动处理识别结果的拼接

## 依赖关系 (FROM)

- React 19 (useState, useRef, useEffect)
- 浏览器 Web Audio API
- 浏览器 Web Speech API

## 下游消费者 (TO)

- `src/StudioPage.tsx` (主要消费者)

## 模块坐标 (HERE)

位于 `src/hooks/`，是音频能力的封装层。

## 注意事项

1. **浏览器兼容性**: Web Speech API在非Chrome浏览器可能不可用，Hook返回 `isSupported` 标志
2. **权限**: 音频录制需要用户授权麦克风权限
3. **自动播放限制**: 浏览器可能阻止自动播放音频，需要用户交互触发

## 关联文档

- [P2-src 前端应用](../../src/AGENTS.md)

---
*本文档遵循DIP协议*
