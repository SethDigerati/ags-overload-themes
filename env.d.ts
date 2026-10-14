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
  export function file_read_link(filename: string): string
  export function mkdir_with_parents(path: string, mode: number): boolean
  export function get_num_processors(): number
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

  export const SOURCE_REMOVE: boolean
  export const SOURCE_CONTINUE: boolean
  export const PRIORITY_DEFAULT: number

  export function source_remove(id: number): boolean
  export function timeout_add(priority: number, intervalMs: number, fn: () => boolean): number

  export class Dir {
    static open(path: string, flags: number): Dir | null
    read_name(): string | null
    close(): void
  }
}

declare module "gi://Soup?version=3.0" {
  export class Session {
    timeout: number
    idle_timeout: number
    /**
     * Takes a SoupMessage (there is no URL overload) plus exactly six
     * arguments: message, origin, protocols, io_priority, cancellable,
     * callback.
     */
    websocket_connect_async(
      message: Message,
      origin: string | null,
      protocols: string[] | null,
      ioPriority: number,
      cancellable: object | null,
      callback: (session: Session, result: object) => void,
    ): void
    websocket_connect_finish(result: object): WebsocketConnection
  }

  export class Message {
    constructor(props: { method?: string; uri?: object })
    static new(method: string, uri: string): Message
    status_code: number
    get_request_headers(): MessageHeaders
  }

  export class MessageHeaders {
    append(name: string, value: string): void
    set(name: string, value: string): void
  }

  export class WebsocketConnection {
    close(code: number, reason: string): void
    get_close_code(): number
    connect(signal: string, callback: (...args: any[]) => void): number
  }

  export const WebsocketDataType: { TEXT: 1; BINARY: 2; CLOSE: number }
  export const WebsocketCloseCode: { NORMAL: 1000 }
}
