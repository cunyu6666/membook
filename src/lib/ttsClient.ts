/**
 * [WHO]: 提供百炼TTS语音合成客户端函数 synthesizeWithBailian
 * [FROM]: 浏览器fetch API
 * [TO]: 被App.tsx消费，用于将文本合成为音频
 * [HERE]: src/lib/ttsClient.ts，前端与百炼TTS服务的客户端代理
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function synthesizeWithBailian(input: {
  apiKey: string;
  endpoint: string;
  model: string;
  text: string;
  voice: string;
  instructions: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/api/tts/bailian`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(detail?.error || `Bailian TTS failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    mimeType: string;
    audioBase64: string;
  };
  return `data:${result.mimeType};base64,${result.audioBase64}`;
}
