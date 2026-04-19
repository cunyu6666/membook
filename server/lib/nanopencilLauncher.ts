/**
 * NanoPencil launch resolution — finds CLI path and builds launch config.
 */
import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";

export type NanoPencilLaunch = {
  command: string;
  displayName: string;
  cliPath?: string;
  useNode?: boolean;
};

export function resolveNanoPencilLaunch(): NanoPencilLaunch | null {
  const configuredCliPath = process.env.NANOPENCIL_CLI_PATH?.trim();
  if (configuredCliPath) {
    const cliPath = resolve(configuredCliPath);
    if (!existsSync(cliPath)) return null;
    return {
      command: isNodeScript(cliPath) ? process.execPath : cliPath,
      cliPath,
      displayName: cliPath,
      useNode: isNodeScript(cliPath),
    };
  }

  const localBin = findFirstExecutable([
    resolve(process.cwd(), "node_modules/.bin/nanopencil"),
    resolve(process.cwd(), "node_modules/.bin/nano-pencil"),
  ]);
  if (localBin) {
    return { command: localBin, cliPath: localBin, displayName: localBin, useNode: false };
  }

  const pathCommand = findCommandOnPath(["nanopencil", "nano-pencil"]);
  if (pathCommand) {
    return { command: pathCommand, displayName: pathCommand, useNode: false };
  }

  return null;
}

function isNodeScript(filePath: string) {
  return /\.(?:cjs|mjs|js)$/i.test(filePath);
}

function findFirstExecutable(candidates: string[]) {
  return candidates.find((candidate) => isExecutable(candidate));
}

function findCommandOnPath(commands: string[]) {
  const pathParts = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];

  for (const command of commands) {
    if (isAbsolute(command) && isExecutable(command)) return command;
    for (const pathPart of pathParts) {
      for (const extension of extensions) {
        const candidate = join(pathPart, `${command}${extension}`);
        if (isExecutable(candidate)) return candidate;
      }
    }
  }
  return "";
}

function isExecutable(filePath: string) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
