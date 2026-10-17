import { Gtk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"
import { readFile, writeFile } from "./util"
import { env, intervals } from "../config"
const API_KEY = env.ZENQUOTES_API_KEY || ""
const DATA_DIR = "/tmp/ags/quote"
const CACHE_FILE = `${DATA_DIR}/data.json`

const token = API_KEY ? `?token=${API_KEY}` : ""

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

function isValidImageFile(path: string): boolean {
  try {
    if (!GLib.file_test(path, GLib.FileTest.IS_REGULAR)) return false
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok || !bytes || bytes.length < 500) {
      try { GLib.unlink(path) } catch { /* ignore */ }
      return false
    }
    return true
  } catch {
    return false
  }
}

// Stable per-author filename: a new author gets a NEW path (forcing both the
// reactive signal and GTK's texture cache to update), a repeated author
// reuses its cached avatar instantly without re-fetching.
function authorImagePath(author: string): string {
  return `${DATA_DIR}/author_${hashStr(author)}.png`
}

let initialQuote = { text: "Loading...", author: "Unknown" }
let initialImage = ""
try {
  const cached = readFile(CACHE_FILE)
  if (cached) {
    const parsed = JSON.parse(cached)
    if (parsed.text && parsed.author) {
      initialQuote = { text: parsed.text, author: parsed.author }
      if (parsed.image && isValidImageFile(parsed.image)) {
        initialImage = parsed.image
      }
    }
  }
} catch { /* ignore */ }

const [quote, setQuote] = createState(initialQuote)
const [authorImage, setAuthorImage] = createState(initialImage)

async function resolveAuthorImage(author: string, remoteUrl?: string): Promise<string> {
  const dest = authorImagePath(author)
  if (isValidImageFile(dest)) return dest

  // 1. Try author image provided by API if available
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl)
      if (res && res.ok) {
        const bytes = await res.bytes()
        const arr = bytes?.toArray()
        if (arr && arr.length > 500) {
          writeFile(dest, arr)
          return dest
        }
      }
    } catch { /* fallback to UI avatars */ }
  }

  // 2. Fallback to UI-Avatars with theme gold (#FFE020) on dark (#1a1a1a)
  try {
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&size=80&background=1a1a1a&color=FFE020`
    const res = await fetch(avatarUrl)
    if (res && res.ok) {
      const bytes = await res.bytes()
      const arr = bytes?.toArray()
      if (arr && arr.length > 500) {
        writeFile(dest, arr)
        return dest
      }
    }
  } catch (e) {
    console.error("quote avatar fetch error:", e)
  }

  return ""
}

async function fetchQuote() {
  try {
    const res = await fetch(`https://zenquotes.io/api/today${token}`)
    const data = await res.json()
    if (!data?.[0] || !data[0].q) return
    const newQuote = { text: data[0].q, author: data[0].a || "Unknown" }
    const isDifferent = newQuote.text !== quote().text || newQuote.author !== quote().author
    if (isDifferent || !authorImage() || !isValidImageFile(authorImage())) {
      // Resolve the avatar first, then swap text + image in the same tick
      // so quote, author, and picture never desync.
      const imgPath = await resolveAuthorImage(newQuote.author, data[0].i)
      setQuote(newQuote)
      setAuthorImage(imgPath)
      writeFile(CACHE_FILE, JSON.stringify({ ...newQuote, image: imgPath }))
    }
  } catch (e) { console.error("quote fetch:", e) }
}

interval(intervals.quote, () => fetchQuote().catch((e) => console.error("quote poll:", e)))
Gio.NetworkMonitor.get_default()?.connect("network-changed", (_m: any, online: boolean) => {
  if (online) {
    fetchQuote().catch((e) => console.error("quote poll:", e))
  }
})
fetchQuote().catch((e) => console.error("quote init:", e))

export function QuoteBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="QUOTE" />
      <box class="hr-line" />
      <box spacing={8}>
        <box
          class="cover-frame"
          widthRequest={82}
          heightRequest={82}
          overflow={Gtk.Overflow.HIDDEN}
          halign={Gtk.Align.START}
          valign={Gtk.Align.START}
          visible={createComputed(() => !!authorImage())}
        >
          <image
            class="cover-art"
            file={createComputed(() => authorImage())}
            pixelSize={80}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
          />
        </box>
        <label wrap maxWidthChars={40} class="gray1" label={createComputed(() => quote().text)} xalign={0} hexpand valign={Gtk.Align.CENTER} />
      </box>
      <label wrap ellipsize={3} maxWidthChars={40} class="quote-author" label={createComputed(() => `~${quote().author}~`)} xalign={0} />
    </box>
  )
}
