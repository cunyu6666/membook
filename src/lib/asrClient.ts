/**
 * [WHO]: 提供百炼ASR语音识别客户端函数 transcribeWithBailian
 * [FROM]: 浏览器FileReader API、fetch API
 * [TO]: 被App.tsx消费，用于音频文件转文字
 * [HERE]: src/lib/asrClient.ts，前端与百炼ASR服务的客户端代理
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function transcribeWithBailian(input: {
  apiKey: string;
  endpoint: string;
  model?: string;
  file: File;
}): Promise<string> {
  const audioBase64 = await fileToBase64(input.file);
  const response = await fetch(`${API_BASE}/api/asr/bailian`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: input.apiKey,
      endpoint: input.endpoint,
      model: input.model,
      fileName: input.file.name,
      mimeType: input.file.type || "audio/mpeg",
      audioBase64,
    }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(detail?.error || `Bailian ASR failed: ${response.status}`);
  }

  const result = (await response.json()) as { text?: string };
  return result.text ?? "";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
