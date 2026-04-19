/**
 * [WHO]: 提供 NanoPencilRpcClient 类，管理nanoPencil子进程并通过NDJSON协议通信
 * [FROM]: 依赖Node.js child_process、readline、fs模块
 * [TO]: 被server/index.ts消费，用于RPC模式调用nanoPencil CLI
 * [HERE]: server/nanopencil-rpc.ts，nanoPencil RPC客户端实现
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { existsSync } from "node:fs";

type RpcResponse = {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
};

type AgentEvent = {
  type?: string;
  assistantMessageEvent?: {
    type?: string;
    delta?: string;
  };
};

export type NanoPencilRpcOptions = {
  command: string;
  cwd: string;
  cliPath?: string;
  useNode?: boolean;
  displayName?: string;
  timeoutMs?: number;
  extraArgs?: string[];
};

export class NanoPencilRpcClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private reader: Interface | null = null;
  private stderr = "";
  private requestId = 0;
  private pending = new Map<
    string,
    {
      command: string;
      resolve: (response: RpcResponse) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private eventListeners = new Set<(event: AgentEvent) => void>();

  constructor(private readonly options: NanoPencilRpcOptions) {}

  isAvailable() {
    return this.options.cliPath ? existsSync(this.options.cliPath) : Boolean(this.options.command);
  }

  async promptAndWait(message: string) {
    await this.start();
    let text = "";
    const unsubscribe = this.onEvent((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        text += event.assistantMessageEvent.delta ?? "";
      }
    });

    try {
      const done = this.waitForEvent("agent_end", this.options.timeoutMs ?? 120000);
      await this.send("prompt", { type: "prompt", message });
      await done;
      const lastText = await this.getLastAssistantText();
      return lastText || text;
    } finally {
      unsubscribe();
    }
  }

  async stop() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("nanoPencil RPC client stopped"));
    }
    this.pending.clear();
    this.reader?.close();
    this.reader = null;
    this.child?.kill("SIGTERM");
    this.child = null;
  }

  private async start() {
    if (this.child) {
      return;
    }
    if (!this.isAvailable()) {
      throw new Error(`nanoPencil CLI not found: ${this.options.displayName ?? this.options.command}`);
    }

    const command = this.options.useNode ? process.execPath : this.options.command;
    const args = [
      ...(this.options.useNode && this.options.cliPath ? [this.options.cliPath] : []),
      "--mode",
      "rpc",
      "--cwd",
      this.options.cwd,
      ...(this.options.extraArgs ?? []),
    ];

    this.child = spawn(command, args, {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        NANOPENCIL_CWD: this.options.cwd,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.on("data", (data) => {
      this.stderr += data.toString();
    });
    this.child.on("exit", (code) => {
      const error = new Error(
        `nanoPencil RPC exited with code ${code}. ${this.stderr}`,
      );
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      this.pending.clear();
      this.reader?.close();
      this.reader = null;
      this.child = null;
    });

    this.reader = createInterface({
      input: this.child.stdout,
      terminal: false,
    });
    this.reader.on("line", (line) => this.handleLine(line));

    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!this.child || this.child.exitCode !== null) {
      throw new Error(`nanoPencil RPC failed to start. ${this.stderr}`);
    }
  }

  private handleLine(line: string) {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (
      message &&
      typeof message === "object" &&
      (message as { type?: unknown }).type === "response" &&
      typeof (message as { id?: unknown }).id === "string"
    ) {
      const response = message as RpcResponse;
      const pending = this.pending.get(response.id!);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(response.id!);
        pending.resolve(response);
      }
      return;
    }

    for (const listener of this.eventListeners) {
      listener(message as AgentEvent);
    }
  }

  private onEvent(listener: (event: AgentEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private waitForEvent(type: string, timeoutMs: number) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(
          new Error(`Timed out waiting for ${type}. nanoPencil stderr: ${this.stderr}`),
        );
      }, timeoutMs);
      const unsubscribe = this.onEvent((event) => {
        if (event.type === type) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private async getLastAssistantText() {
    const response = await this.send("get_last_assistant_text", {
      type: "get_last_assistant_text",
    });
    const data = response.data as { text?: string | null } | undefined;
    return data?.text ?? "";
  }

  private send(command: string, payload: Record<string, unknown>) {
    if (!this.child?.stdin) {
      throw new Error("nanoPencil RPC process is not running");
    }

    const id = `membook_${++this.requestId}`;
    const timeoutMs = this.options.timeoutMs ?? 120000;

    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for nanoPencil ${command}. ${this.stderr}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { command, resolve, reject, timer });
      this.child!.stdin.write(`${JSON.stringify({ ...payload, id })}\n`);
    }).then((response) => {
      if (!response.success) {
        throw new Error(response.error || `nanoPencil ${command} failed`);
      }
      return response;
    });
  }
}
