import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"

const { BOTTOM, LEFT } = Astal.WindowAnchor
const API_KEY = env.NEWS_API_KEY || ""

type Article = { title: string; source: string }
const [newsData, setNewsData] = createState<Record<string, Article[]>>({
  tech: [], science: [], space: [], climate: [],
})

const newsText = createComputed(() => {
  const d = newsData()
  let text = ""
  const labels: Record<string, string> = { tech: "TECH", science: "SCIENCE", space: "SPACE", climate: "CLIMATE" }
  for (const [cat, articles] of Object.entries(d)) {
    text += `── ${labels[cat] || cat} ──\n`
    for (const a of articles) text += `${a.source}: ${a.title}\n`
    text += "\n"
  }
  return text
})

const categories = ["tech", "science", "space", "climate"]

async function fetchCategory(cat: string) {
  if (!API_KEY) return
  try {
    let url: string
    if (cat === "space") url = `https://newsapi.org/v2/everything?q=space&language=en&pageSize=2&apiKey=${API_KEY}`
    else if (cat === "climate") url = `https://newsapi.org/v2/everything?q=climate&language=en&pageSize=2&apiKey=${API_KEY}`
    else url = `https://newsapi.org/v2/top-headlines?language=en&category=${cat}&pageSize=2&apiKey=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data?.articles?.length) {
      const current = { ...newsData() }
      current[cat] = data.articles.slice(0, 2).map((a: any) => ({
        title: a.title || "N/A",
        source: a.source?.name || "",
      }))
      setNewsData(current)
    }
  } catch (e) { console.error(`news ${cat}:`, e) }
}

let catIdx = 0
interval(300000, () => { fetchCategory(categories[catIdx % categories.length]).catch((e) => console.error("news poll:", e)); catIdx++ })
categories.forEach(c => fetchCategory(c).catch((e) => console.error("news init:", e)))

export default function NewsWidget() {
  return (
    <window visible name="news" class="News" anchor={BOTTOM | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap class="section-header" label="NEWS" />
        <label wrap class="gray3" label="SOURCE: NewsAPI.org" xalign={1} />
        <label wrap class="gray1" label={newsText} xalign={0} />
      </box>
    </window>
  )
}
