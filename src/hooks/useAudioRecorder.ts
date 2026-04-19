/**
 * [WHO]: 提供 useAudioRecorder Hook，封装浏览器音频录制能力(PCM16编码、WAV导出)
 * [FROM]: 依赖React hooks、浏览器Web Audio API、navigator.mediaDevices
 * [TO]: 被App.tsx消费，用于录制长辈回答音频
 * [HERE]: src/hooks/useAudioRecorder.ts，音频能力封装层
 */
import { useRef, useState } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const stopRef = useRef<(() => File) | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);

  const isSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof AudioContext !== "undefined";

  return {
    isSupported,
    isRecording,
    audioFile,
    setAudioFile,
    start: async () => {
      if (!isSupported) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      pcmChunksRef.current = [];

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(
          downsampleToPcm16(input, audioContext.sampleRate, 16000),
        );
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      stopRef.current = () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        void audioContext.close();
        const wav = encodeWav(pcmChunksRef.current, 16000);
        const file = new File([wav], `interview-${Date.now()}.wav`, {
          type: "audio/wav",
        });
        setAudioFile(file);
        setIsRecording(false);
        return file;
      };

      setIsRecording(true);
    },
    stop: () => {
      const file = stopRef.current?.() ?? null;
      stopRef.current = null;
      return file;
    },
  };
}

function downsampleToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  if (inputSampleRate === outputSampleRate) {
    return floatToPcm16(input);
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), input.length);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += input[cursor] ?? 0;
    }
    output[index] = sum / Math.max(1, end - start);
  }

  return floatToPcm16(output);
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function encodeWav(chunks: Int16Array[], sampleRate: number) {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const pcm = new Int16Array(sampleCount);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }

  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const output = new Int16Array(buffer, 44);
  output.set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
