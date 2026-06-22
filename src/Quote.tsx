import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { readFile, writeFile } from "./util"
import { env } from "../config"

const { BOTTOM, LEFT } = Astal.WindowAnchor
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

const [quote, setQuote] = createState(initialQuote)
const [authorImage, setAuthorImage] = createState("")

async function fetchQuote() {
  try {
    const res = await fetch(`https://zenquotes.io/api/today${token}`)
    const data = await res.json()
    if (!data?.[0]) return
    const newQuote = { text: data[0].q, author: data[0].a }
    setQuote(newQuote)
    writeFile(CACHE_FILE, JSON.stringify(newQuote))
    fetchAuthorImage(data[0])
  } catch (e) { console.error("quote fetch:", e) }
}

async function fetchAuthorImage(data: any) {
  try {
    if (data.i) {
      try {
        const imgRes = await fetch(data.i)
        const imgBytes = await imgRes.bytes()
        if (imgBytes) {
          writeFile(`${DATA_DIR}/author.png`, imgBytes.toArray())
          setAuthorImage(`${DATA_DIR}/author.png`)
          return
        }
      } catch { /* ignore image fetch errors */ }
    }
    try {
      const avatarRes = await fetch(`https://ui-avatars.com/api/?name=${encodeURIComponent(data.a)}&size=80&background=1a1a1a&color=FFE020`)
      const avatarBytes = await avatarRes.bytes()
      if (avatarBytes && avatarBytes.length > 0) {
        writeFile(`${DATA_DIR}/author.png`, avatarBytes.toArray())
        setAuthorImage(`${DATA_DIR}/author.png`)
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

interval(86400000, () => fetchQuote().catch((e) => console.error("quote poll:", e)))
fetchQuote().catch((e) => console.error("quote init:", e))

export default function QuoteWidget() {
  return (
    <window visible name="quote" class="Quote" anchor={BOTTOM | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="QUOTE" />
        <box class="hr-line" />
        <box>
          <label wrap maxWidthChars={40} class="gray1" label={createComputed(() => quote().text)} xalign={0} hexpand valign={Gtk.Align.CENTER} />
          <image file={authorImage} pixelSize={createComputed(() => authorImage() ? 80 : 0)} halign={Gtk.Align.END} valign={Gtk.Align.START} />
        </box>
        <label wrap ellipsize={3} maxWidthChars={40} class="quote-author" label={createComputed(() => `~${quote().author}~`)} xalign={1} />
      </box>
    </window>
  )
}
