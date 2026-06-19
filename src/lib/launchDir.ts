import { invoke } from "@tauri-apps/api/core";

let cached: string | undefined;
let cliArg = false;

export async function initLaunchDir(): Promise<void> {
  const fromCli = await invoke<string | null>("get_launch_dir").catch(() => null);
  if (fromCli) {
    cliArg = true;
    cached = fromCli.replace(/\\/g, "/");
    return;
  }
  const fromCwd = await invoke<string>("workspace_current_dir").catch(() => null);
  cached = fromCwd ? fromCwd.replace(/\\/g, "/") : undefined;
}

export function getLaunchDir(): string | undefined {
  return cached;
}

export function hadCliArg(): boolean {
  return cliArg;
}
