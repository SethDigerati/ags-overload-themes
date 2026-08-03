import { Gtk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { readFile, writeFile } from "./util"
import { env, intervals } from "../config"
const API_KEY = env.ZENQUOTES_API_KEY || ""
const DATA_DIR = "/tmp/ags/quote"
const CACHE_FILE = `${DATA_DIR}/data.json`

const token = API_KEY ? `?token=${API_KEY}` : ""

let initialQuote = { text: "Loading...", author: "Unknown" }
try {
  const cached = readFile(CACHE_FILE)
  if (cached) {
    const parsed = JSON.parse(cached)
    if (parsed.text && parsed.author) initialQuote = parsed
  }
} catch { /* ignore */ }

let initialImage = ""
try {
  if (readFile(`${DATA_DIR}/author.png`)) initialImage = `${DATA_DIR}/author.png`
} catch { /* ignore */ }

const [quote, setQuote] = createState(initialQuote)
const [authorImage, setAuthorImage] = createState(initialImage)

async function fetchQuote() {
  try {
    const res = await fetch(`https://zenquotes.io/api/today${token}`)
    const data = await res.json()
    if (!data?.[0] || !data[0].q) return
    const newQuote = { text: data[0].q, author: data[0].a || "Unknown" }
    const changed = newQuote.text !== quote().text
    if (changed) {
      setQuote(newQuote)
      writeFile(CACHE_FILE, JSON.stringify(newQuote))
    }
    if (changed || !authorImage()) fetchAuthorImage(data[0])
  } catch (e) { console.error("quote fetch:", e) }
}

async function fetchAuthorImage(data: any) {
  try {
    if (data.i) {
      try {
        const imgRes = await fetch(data.i)
        const imgBytes = await imgRes.bytes()
        const imgArray = imgBytes?.toArray()
        if (imgArray && imgArray.length > 0) {
          writeFile(`${DATA_DIR}/author.png`, imgArray)
          setAuthorImage(`${DATA_DIR}/author.png`)
          return
        }
      } catch { /* ignore image fetch errors */ }
    }
    try {
      const avatarRes = await fetch(`https://ui-avatars.com/api/?name=${encodeURIComponent(data.a)}&size=80&background=1a1a1a&color=FFE020`)
      const avatarBytes = await avatarRes.bytes()
      const avatarArray = avatarBytes?.toArray()
      if (avatarArray && avatarArray.length > 0) {
        writeFile(`${DATA_DIR}/author.png`, avatarArray)
        setAuthorImage(`${DATA_DIR}/author.png`)
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

interval(intervals.quote, () => fetchQuote().catch((e) => console.error("quote poll:", e)))
fetchQuote().catch((e) => console.error("quote init:", e))

export function QuoteBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="QUOTE" />
      <box class="hr-line" />
      <box>
        <label wrap maxWidthChars={40} class="gray1" label={createComputed(() => quote().text)} xalign={0} hexpand valign={Gtk.Align.CENTER} />
        <image file={authorImage} pixelSize={createComputed(() => authorImage() ? 80 : 0)} halign={Gtk.Align.END} valign={Gtk.Align.START} />
      </box>
      <label wrap ellipsize={3} maxWidthChars={40} class="quote-author" label={createComputed(() => `~${quote().author}~`)} xalign={1} />
    </box>
  )
}
