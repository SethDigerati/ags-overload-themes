import { Gtk } from "ags/gtk4"
import { createState, createComputed, type Accessor } from "ags"
import { timeout } from "ags/time"
import { fetch } from "ags/fetch"
import Gio from "gi://Gio?version=2.0"
import { createWebSocketStream, type WebSocketStreamHandle } from "./util"
import { leftColumnWidgets, rightColumnWidgets } from "../config"

type Asset = {
  name: string
  cur: string
  pct1h: string
  pct1d: string
  pct1w: string
  pct1m: string
  pct1y: string
}

// Display order and the Binance market each row streams from.
const MARKETS: Array<[string, string]> = [
  ["BTCUSDT", "BTC"],
  ["ETHUSDT", "ETH"],
  ["SOLUSDT", "SOL"],
  ["XRPUSDT", "XRP"],
  ["DOGEUSDT", "DOGE"],
  ["ADAUSDT", "ADA"],
]
const SYMBOL_NAME: Record<string, string> = Object.fromEntries(MARKETS.map(([s, n]) => [s, n]))

// Coin ids, in the same order, for the historical 1h/1w/1m/1y columns.
const CG_IDS = ["bitcoin", "ethereum", "solana", "ripple", "dogecoin", "cardano"]

const ASSET_W = 50
const PRICE_W = 66
const PCT_W = 56

const countryCurrency: Record<string, string> = {
  US: "USD", IN: "INR", GB: "GBP", JP: "JPY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  NL: "EUR", BE: "EUR", PT: "EUR", IE: "EUR",
  AT: "EUR", FI: "EUR", GR: "EUR",
  CA: "CAD", AU: "AUD", CH: "CHF", CN: "CNY",
  KR: "KRW", SG: "SGD", HK: "HKD", TW: "TWD",
  BR: "BRL", MX: "MXN", ZA: "ZAR", SE: "SEK",
  NO: "NOK", NZ: "NZD", RU: "RUB", TR: "TRY",
  AE: "AED", SA: "SAR", TH: "THB", MY: "MYR",
  PH: "PHP", ID: "IDR", VN: "VND", EG: "EGP",
  KE: "KES", TZ: "TZS", UG: "UGX", GH: "GHS",
  MA: "MAD", DZ: "DZD", TN: "TND", QA: "QAR",
  KW: "KWD", OM: "OMR", BH: "BHD", JO: "JOD",
  LB: "LBP", RO: "RON", BG: "BGN", RS: "RSD",
  HR: "HRK", IS: "ISK",
  AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN",
  PL: "PLN", CZ: "CZK", HU: "HUF", DK: "DKK",
  IL: "ILS", PK: "PKR", BD: "BDT", NG: "NGN",
  LT: "EUR", LV: "EUR", EE: "EUR", SK: "EUR",
  SI: "EUR", CY: "EUR", MT: "EUR", LU: "EUR",
}
const currencySymbols: Record<string, string> = {
  USD: "$", INR: "₹", EUR: "€", JPY: "¥",
  GBP: "£", CAD: "C$", AUD: "A$", CHF: "Fr",
  CNY: "¥", KRW: "₩", SGD: "S$", HKD: "HK$",
  TWD: "NT$", BRL: "R$", MXN: "MX$", ZAR: "R",
  SEK: "kr", NOK: "kr", NZD: "NZ$", RUB: "₽",
  TRY: "₺", AED: "د.إ", SAR: "﷼", THB: "฿",
  KES: "KSh", TZS: "TSh", UGX: "USh", GHS: "GH₵",
  MAD: "MAD", DZD: "د.ج", TND: "د.ت", QAR: "ر.ق",
  KWD: "د.ك", OMR: "ر.ع", BHD: "د.ب", JOD: "د.ا",
  LBP: "ل.ل", RON: "lei", BGN: "лв", RSD: "дин",
  HRK: "kn", ISK: "kr",
  ARS: "$", COP: "$", CLP: "$", PEN: "S/",
  PLN: "zł", CZK: "Kč", HUF: "Ft", DKK: "kr",
  ILS: "₪", PKR: "₨", BDT: "৳", NGN: "₦",
}

let locationCountry = ""
async function fetchLocation(): Promise<void> {
  try {
    const res = await fetch("https://ipinfo.io/country")
    const text = await res.text()
    if (text) locationCountry = text.trim()
  } catch { /* forex falls back to USD */ }
}

function placeholder(name: string): Asset {
  return { name, cur: "...", pct1h: "0", pct1d: "0", pct1w: "0", pct1m: "0", pct1y: "0" }
}

const [assets, setAssets] = createState<Asset[]>(MARKETS.map(([, n]) => placeholder(n)))
const [live, setLive] = createState(false)
const [forex, setForex] = createState("")
/** Flips once either the ticker stream or the historical poll lands data. */
export const [marketReady, setMarketReady] = createState(false)

// One accessor per row: a ticker for one symbol re-renders only that row's
// labels instead of rebuilding the whole table several times a second.
const rows: Accessor<Asset>[] = MARKETS.map(([, name]) =>
  createComputed(() => assets().find(a => a.name === name) ?? placeholder(name)),
)

function thousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function formatPrice(raw: unknown): string {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw))
  if (!Number.isFinite(n)) return "N/A"
  if (n >= 1000) return `$${thousands(n.toFixed(2))}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function fmtPct(raw: unknown, prev: string): string {
  const n = Number(raw)
  return Number.isFinite(n) ? n.toFixed(1) : prev
}

// ── Live prices: Binance ticker stream ──
// Zero API keys, sub-second updates, and no REST polling to rate-limit.

const BINANCE_URL =
  `wss://stream.binance.com:9443/stream?streams=${MARKETS.map(([s]) => `${s.toLowerCase()}@ticker`).join("/")}`

let stream: WebSocketStreamHandle | null = null

function onTicker(raw: string): void {
  let payload: { data?: Record<string, unknown> }
  try { payload = JSON.parse(raw) }
  catch { return } // one malformed frame must not kill the stream

  const d = payload?.data
  if (!d) return
  const name = SYMBOL_NAME[String(d.s)] ?? String(d.s ?? "").replace(/USDT$/, "")
  const idx = assets().findIndex(a => a.name === name)
  if (idx < 0) return

  const next = assets().slice()
  next[idx] = {
    ...next[idx],
    cur: formatPrice(d.c),
    pct1d: fmtPct(d.P, next[idx].pct1d),
  }
  setAssets(next)
  setMarketReady(true)
}

function startStream(): void {
  stream?.close()
  stream = createWebSocketStream(
    BINANCE_URL,
    onTicker,
    (e) => console.error("market stream:", e?.message ?? e),
    (connected) => setLive(connected),
  )
}

// ── History: CoinGecko, relaxed to 10 minutes with backoff ──

const CG_INTERVAL = 600000
const CG_BACKOFF_MIN = 10000
const CG_BACKOFF_MAX = 600000
const CG_BLOCK_MS = 30 * 60 * 1000

let cgBlockedUntil = 0
let cgBackoff = 0

async function fetchCoinGecko(): Promise<void> {
  if (Date.now() < cgBlockedUntil) return
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CG_IDS.join(",")}` +
    `&price_change_percentage=1h,24h,7d,30d,1y&order=market_cap_desc`
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ags-overload-themes/1.0" } })
    if (res.status === 429) {
      cgBlockedUntil = Date.now() + CG_BLOCK_MS
      console.warn("market: coingecko rate limited, pausing for 30min")
      return
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    if (!Array.isArray(data) || !data.length) return

    const next = assets().slice()
    let changed = false
    for (const entry of data) {
      const i = next.findIndex(a => a.name === String(entry.symbol).toUpperCase())
      if (i < 0) continue
      const prev = next[i]
      next[i] = {
        ...prev,
        // cur and pct1d stay owned by the ticker stream
        pct1h: fmtPct(entry.price_change_percentage_1h_in_currency, prev.pct1h),
        pct1w: fmtPct(entry.price_change_percentage_7d_in_currency, prev.pct1w),
        pct1m: fmtPct(entry.price_change_percentage_30d_in_currency, prev.pct1m),
        pct1y: fmtPct(entry.price_change_percentage_1y_in_currency, prev.pct1y),
      }
      changed = true
    }
    if (!changed) return
    setAssets(next)
    cgBackoff = 0
    setMarketReady(true)
  } catch (e) {
    cgBackoff = Math.min(cgBackoff ? cgBackoff * 2 : CG_BACKOFF_MIN, CG_BACKOFF_MAX)
    console.error("market: coingecko failed:", e)
  }
}

// ── Forex: fiat rates move too slowly to justify anything tighter ──

async function fetchForex(): Promise<void> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD")
    const data = await res.json()
    if (!data?.rates) return
    const parts: string[] = []
    const localCode = countryCurrency[locationCountry] || "USD"
    const rate = localCode === "USD" ? 1 : data.rates[localCode]
    if (rate) {
      const sym = currencySymbols[localCode] || localCode
      parts.push(`1 USD = ${rate.toFixed(2)} ${sym}`)
    }
    const eurRate = data.rates.EUR
    if (eurRate) {
      if (parts.length > 0) parts.push(" | ")
      parts.push(`1 USD = ${eurRate.toFixed(2)} ${currencySymbols.EUR || "EUR"}`)
    }
    const jpyRate = data.rates.JPY
    if (jpyRate) {
      if (parts.length > 0) parts.push(" | ")
      parts.push(`1 USD = ${jpyRate.toFixed(2)} ${currencySymbols.JPY || "JPY"}`)
    }
    setForex(parts.length > 0 ? parts.join("") : "...")
  } catch (e) { console.error("market forex:", e) }
}

// Chained rather than interval-driven, so a failed cycle can back off without
// ever stacking timers on top of the poll period.
let remoteTimer: { cancel(): void } | null = null

async function pollRemote(): Promise<void> {
  await Promise.all([fetchCoinGecko(), fetchForex()])
}

function scheduleRemote(delay: number): void {
  remoteTimer?.cancel()
  remoteTimer = timeout(delay, () => {
    pollRemote()
      .catch((e) => console.error("market poll:", e))
      .then(() => scheduleRemote(cgBackoff ? cgBackoff : CG_INTERVAL))
  })
}

function PctHead({ label }: { label: string }) {
  return (
    <box widthRequest={PCT_W} spacing={0}>
      <box widthRequest={12} />
      <label wrap class="accent" label={label} xalign={0} />
    </box>
  )
}

function PctCell({ val }: { val: Accessor<string> }) {
  const text = createComputed(() => {
    const raw = val()
    const n = parseFloat(raw)
    if (n > 0) return { arrow: "▲", abs: false, text: `${raw}%` }
    if (n < 0) return { arrow: "▼", abs: true, text: `${Math.abs(n).toFixed(1)}%` }
    return { arrow: "─", abs: false, text: "0.0%" }
  })

  return (
    <box widthRequest={PCT_W} spacing={0}>
      <label
        wrap
        class={createComputed(() => text().abs ? "negative" : text().arrow === "▲" ? "positive" : "gray2")}
        label={createComputed(() => text().arrow)}
        xalign={0}
        widthRequest={12}
      />
      <label
        wrap
        ellipsize={3}
        maxWidthChars={5}
        class="gray2"
        label={createComputed(() => text().text)}
        xalign={0}
      />
    </box>
  )
}

function AssetRow({ row }: { row: Accessor<Asset> }) {
  return (
    <box widthRequest={399} spacing={5}>
      <label ellipsize={3} maxWidthChars={6} wrap xalign={0} class="gray2"
        label={createComputed(() => row().name)} widthRequest={ASSET_W} />
      <label ellipsize={3} maxWidthChars={9} wrap xalign={1} class="gray2"
        label={createComputed(() => row().cur)} widthRequest={PRICE_W} />
      <PctCell val={createComputed(() => row().pct1h)} />
      <PctCell val={createComputed(() => row().pct1d)} />
      <PctCell val={createComputed(() => row().pct1w)} />
      <PctCell val={createComputed(() => row().pct1m)} />
      <PctCell val={createComputed(() => row().pct1y)} />
    </box>
  )
}

export function MarketBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <box>
        <label wrap xalign={0} hexpand class="section-header" label="MARKET" />
        <label
          xalign={1}
          label={createComputed(() => (live() ? "● LIVE" : "○ OFF"))}
          cssClasses={createComputed(() => [live() ? "positive" : "gray3"])}
        />
      </box>
      <box class="hr-line" />
      <box spacing={5}>
        <label wrap class="accent" label="ASSET" xalign={0} widthRequest={ASSET_W} />
        <label wrap class="accent" label="PRICE" xalign={1} widthRequest={PRICE_W} />
        <PctHead label="1h" />
        <PctHead label="1d" />
        <PctHead label="1w" />
        <PctHead label="1m" />
        <PctHead label="1y" />
      </box>
      <box class="hr-line" />
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        {rows.map((row, i) => <AssetRow key={String(i)} row={row} />)}
      </box>
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={40} wrap class="gray3" label={createComputed(() => forex())} xalign={0.5} />
    </box>
  )
}

const visible = new Set([...rightColumnWidgets, ...leftColumnWidgets]).has("MarketBox")

if (visible) {
  startStream()
  Gio.NetworkMonitor.get_default()?.connect("network-changed", (_m: any, online: boolean) => {
    if (!online) return
    // The stream owns its own reconnect; only the REST side needs nudging.
    fetchLocation()
      .then(() => pollRemote())
      .catch((e) => console.error("market reconnect:", e))
  })
  // Geo-IP is optional context for the forex line and must never gate the
  // price/history fetch, so the two run independently and forex re-renders
  // once the country is known.
  pollRemote().catch((e) => console.error("market init:", e))
  fetchLocation()
    .then(() => fetchForex())
    .catch((e) => console.error("market location:", e))
  scheduleRemote(CG_INTERVAL)
}