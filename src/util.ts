import GLib from "gi://GLib?version=2.0"
import Gio from "gi://Gio?version=2.0"
import Soup from "gi://Soup?version=3.0"

const sharedDecoder = new TextDecoder()
export { sharedDecoder }

export function setIfChanged<T>(get: () => T, set: (v: T) => void, v: T): void {
  if (get() !== v) set(v)
}

export type ExecResult = {
  ok: boolean
  out: string
  err: string
}

/**
 * Run a command asynchronously and *always* resolve, never reject.
 *
 * `ags/process`'s `execAsync` rejects on a non-zero exit and throws the stdout
 * away, which loses data for commands that report through their output while
 * failing (e.g. `ping` exits 1 on partial packet loss but still prints valid
 * rtt/loss numbers). This returns the exit status alongside whatever was
 * written, so callers can decide what a failure means for them.
 */
export function execAsyncRaw(argv: string[]): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve) => {
    let proc: Gio.Subprocess
    try {
      // Throws synchronously when the binary is missing from PATH
      proc = Gio.Subprocess.new(
        argv,
        Gio.SubprocessFlags.STDERR_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
      )
    } catch {
      resolve({ ok: false, out: "", err: "" })
      return
    }

    proc.communicate_utf8_async(null, null, (_p, res) => {
      try {
        const [, out, err] = proc.communicate_utf8_finish(res)
        resolve({
          ok: proc.get_successful(),
          out: (out ?? "").trim(),
          err: (err ?? "").trim(),
        })
      } catch {
        resolve({ ok: false, out: "", err: "" })
      }
    })
  })
}

/**
 * Run a command asynchronously and return its trimmed stdout, or "" on any
 * failure. Never throws.
 */
export async function execAsyncFast(argv: string[]): Promise<string> {
  try {
    const res = await execAsyncRaw(argv)
    return res.ok ? res.out : ""
  } catch { return "" }
}

export function readFile(path: string): string {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (ok) return sharedDecoder.decode(bytes).trim()
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
    if (ok && stdout) return sharedDecoder.decode(stdout).trim()
  } catch { /* ignore */ }
  return ""
}

// ── Native LibSoup 3.0 WebSocket stream ──
// window.WebSocket does not exist under GJS, so the handshake and frame
// handling go through Soup.Session.websocket_connect_async(), which takes a
// SoupMessage (there is no URL overload) plus exactly six arguments.

export type WebSocketStreamHandle = {
  /** Permanently tear the stream down and stop retrying. */
  close(): void
  /** Currently connected and receiving frames. */
  isOpen(): boolean
  /** Force an immediate reconnect attempt (resets the backoff ladder). */
  reconnect(): void
}

const WS_MIN_RETRY = 5000
const WS_MAX_RETRY = 60000

let sharedSession: Soup.Session | null = null

function getSession(): Soup.Session | null {
  if (sharedSession) return sharedSession
  try {
    const session = new Soup.Session()
    session.timeout = 20
    session.idle_timeout = 30
    sharedSession = session
  } catch {
    sharedSession = null
  }
  return sharedSession
}

/**
 * Open a resilient WebSocket stream.
 *
 * Reconnects on drop with an exponential ladder (5s -> 10s -> 20s -> 40s -> 60s
 * cap) that resets on the first successful frame. Going offline closes the
 * socket and freezes the timer; coming back online reconnects immediately.
 * A pending retry and a pending connect can never both be in flight, so a
 * flapping link cannot spawn a retry storm.
 */
export function createWebSocketStream(
  url: string,
  onMessage: (data: string) => void,
  onError?: (err: any) => void,
  onStateChange?: (connected: boolean) => void,
): WebSocketStreamHandle {
  const session = getSession()
  const monitor = Gio.NetworkMonitor.get_default()

  let conn: any = null
  let retryId = 0
  let connectPending = false
  let attempt = 0
  let open = false
  let disposed = false
  let suppressing = false

  function clearRetry() {
    if (retryId) {
      GLib.source_remove(retryId)
      retryId = 0
    }
  }

  function setOpen(next: boolean) {
    if (open === next) return
    open = next
    onStateChange?.(next)
  }

  function teardown() {
    const current = conn
    conn = null
    if (!current) return
    setOpen(false)
    // The socket fires `closing`/`closed` as a result of this very call, which
    // must not be mistaken for a network drop and trigger a reconnect.
    suppressing = true
    try {
      current.close(Soup.WebsocketCloseCode.NORMAL, "")
    } catch { /* already torn down by libsoup */ }
    suppressing = false
  }

  function scheduleRetry() {
    if (disposed || suppressing || retryId || connectPending || conn) return
    const delay = Math.min(WS_MIN_RETRY * 2 ** attempt, WS_MAX_RETRY)
    attempt += 1
    retryId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      retryId = 0
      connect()
      return GLib.SOURCE_REMOVE
    })
  }

  function onDisconnect(socket: any, err: any) {
    // A socket we already replaced still fires `closing`/`closed` afterwards.
    // Those must not tear down the live connection or queue a bogus retry.
    if (socket && socket !== conn) return
    connectPending = false
    teardown()
    if (err !== undefined) onError?.(err)
    scheduleRetry()
  }

  function connect() {
    if (disposed || connectPending || conn) return

    const active = session
    if (!active) {
      onError?.(Error("libsoup session unavailable"))
      scheduleRetry()
      return
    }

    let msg: Soup.Message
    try {
      msg = Soup.Message.new("GET", url)
    } catch (e) {
      onError?.(e)
      scheduleRetry()
      return
    }

    connectPending = true
    active.websocket_connect_async(
      msg,
      null,
      [],
      GLib.PRIORITY_DEFAULT,
      null,
      (sessionObj: any, res: any) => {
        connectPending = false
        if (disposed) return

        let socket: any
        try {
          socket = sessionObj.websocket_connect_finish(res)
        } catch (e) {
          onDisconnect(null, e)
          return
        }

        if (disposed) {
          try { socket.close(Soup.WebsocketCloseCode.NORMAL, "") } catch { /* ignore */ }
          return
        }

        // A newer connect may have won the race while this one was in flight
        if (conn) {
          try { socket.close(Soup.WebsocketCloseCode.NORMAL, "") } catch { /* ignore */ }
          return
        }

        conn = socket
        setOpen(true)

        socket.connect("message", (_c: any, type: number, bytes: Uint8Array) => {
          if (type !== Soup.WebsocketDataType.TEXT) return
          attempt = 0
          try {
            onMessage(sharedDecoder.decode(bytes))
          } catch (e) {
            console.error("websocket onMessage:", e)
          }
        })
        socket.connect("error", (_c: any, err: any) => onDisconnect(socket, err))
        socket.connect("closed", () => onDisconnect(socket, undefined))
      },
    )
  }

  if (monitor) {
    try {
      monitor.connect("network-changed", (_m: any, available: boolean) => {
        if (disposed) return
        if (!available) {
          clearRetry()
          teardown()
          return
        }
        attempt = 0
        clearRetry()
        connect()
      })
    } catch { /* monitor is optional */ }
  }

  connect()

  return {
    isOpen: () => open,
    reconnect() {
      if (disposed) return
      attempt = 0
      clearRetry()
      teardown()
      connect()
    },
    close() {
      disposed = true
      clearRetry()
      teardown()
    },
  }
}