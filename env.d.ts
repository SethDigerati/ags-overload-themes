declare const SRC: string
declare var console: { log(...args: any[]): void; error(...args: any[]): void; warn(...args: any[]): void }
declare class TextDecoder { constructor(label?: string); decode(input?: Uint8Array): string }
declare class TextEncoder { constructor(); encode(input?: string): Uint8Array }

declare module "inline:*" {
  const content: string
  export default content
}

declare module "*.scss" {
  const content: string
  export default content
}

declare module "*.blp" {
  const content: string
  export default content
}

declare module "*.css" {
  const content: string
  export default content
}

declare module "gi://GLib?version=2.0" {
  export function file_get_contents(filename: string): [boolean, Uint8Array]
  export function file_set_contents(filename: string, contents: Uint8Array | string): boolean
  export function path_get_dirname(path: string): string
  export function file_test(filename: string, test: number): boolean
  export function mkdir_with_parents(path: string, mode: number): boolean
  export function spawn_command_line_sync(cmd: string): [boolean, Uint8Array | null, Uint8Array | null, number]
  export function spawn_sync(
    pwd: string | null, argv: string[], envp: string[] | null,
    flags: number, child_setup: unknown,
  ): [boolean, Uint8Array | null, Uint8Array | null, number]
  export const FileTest: { IS_DIR: number; IS_REGULAR: number; EXISTS: number }
  export const SpawnFlags: { SEARCH_PATH: number; STDOUT_TO_DEV_NULL: number; STDERR_TO_DEV_NULL: number }
  export function get_current_dir(): string
  export function get_home_dir(): string
  export function path_basename(path: string): string
  export function unsetenv(key: string): void
}
