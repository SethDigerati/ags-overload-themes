import GLib from "gi://GLib?version=2.0"

export function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (ok) return new TextDecoder().decode(bytes).trim()
  } catch { /* ignore */ }
  return ""
}

export function writeFile(path: string, content: string | Uint8Array): void {
  const dir = GLib.path_get_dirname(path)
  if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) {
    GLib.mkdir_with_parents(dir, 0o755)
  }
  GLib.file_set_contents(path, content)
}

export function exec(cmd: string | string[]): string {
  try {
    const [ok, stdout] = Array.isArray(cmd)
      ? GLib.spawn_sync(null, cmd, null, GLib.SpawnFlags.SEARCH_PATH, null)
      : GLib.spawn_command_line_sync(cmd)
    if (ok && stdout) return new TextDecoder().decode(stdout).trim()
  } catch { /* ignore */ }
  return ""
}
