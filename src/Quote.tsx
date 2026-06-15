import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"

const { TOP, RIGHT } = Astal.WindowAnchor

const [quote, setQuote] = createState({ text: "Loading...", author: "Unknown" })

async function fetchQuote() {
  try {
    const res = await fetch("https://zenquotes.io/api/random")
    const data = await res.json()
    if (data?.[0]) setQuote({ text: data[0].q, author: data[0].a })
  } catch (e) { console.error("quote fetch:", e) }
}

interval(3600000, () => fetchQuote().catch((e) => console.error("quote poll:", e)))
fetchQuote().catch((e) => console.error("quote init:", e))

export default function QuoteWidget() {
  return (
    <window visible name="quote" class="Quote" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <label wrap class="section-header" label="QUOTE" />
        <label wrap class="gray1" label={createComputed(() => quote().text)} xalign={0} />
        <label wrap class="accent" label={createComputed(() => `~${quote().author}~`)} xalign={1} />
      </box>
    </window>
  )
}
