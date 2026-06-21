import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env } from "../config"

const { TOP, LEFT } = Astal.WindowAnchor

const coinIds = ["bitcoin", "ethereum", "solana", "ripple", "dogecoin", "cardano", "binancecoin", "tron", "avalanche-2", "chainlink", "polkadot", "litecoin"]
const coinNames = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "TRX", "AVAX", "LINK", "DOT", "LTC"]

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

async function fetchLocation() {
  try {
    const res = await fetch("https://ipinfo.io/country")
    const text = await res.text()
    if (text) locationCountry = text.trim()
  } catch {}
}

const [assets, setAssets] = createState<Array<{ name: string; cur: string; pct1h: string; pct1d: string; pct1w: string; pct1m: string; pct1y: string }>>(
  coinNames.slice(0, 6).map((n) => ({ name: n, cur: "...", pct1h: "0", pct1d: "0", pct1w: "0", pct1m: "0", pct1y: "0" }))
)
const [forex, setForex] = createState("")

async function fetchMarket() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(",")}&price_change_percentage=1h,24h,7d,30d,1y&order=market_cap_desc`,
      { headers: { "User-Agent": "ags-overload-themes/1.0" } }
    )
    const data = await res.json()
    if (!data?.length) return
    const updated = data.map((d: any, i: number) => ({
      name: coinNames[i] || d.symbol.toUpperCase(),
      cur: d.current_price ? `$${d.current_price.toLocaleString()}` : "N/A",
      pct1h: (d.price_change_percentage_1h_in_currency ?? 0).toFixed(1),
      pct1d: (d.price_change_percentage_24h ?? 0).toFixed(1),
      pct1w: (d.price_change_percentage_7d_in_currency ?? 0).toFixed(1),
      pct1m: (d.price_change_percentage_30d_in_currency ?? 0).toFixed(1),
      pct1y: (d.price_change_percentage_1y_in_currency ?? 0).toFixed(1),
    }))
    setAssets(updated.slice(0, 6))
    console.log("market: got", Math.min(updated.length, 6), "coins")
  } catch (e) { console.error("market fetch:", e) }

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
      if (parts.length > 0) parts.push("  |  ")
      parts.push(`1 USD = ${eurRate.toFixed(2)} ${currencySymbols.EUR || "EUR"}`)
    }
    const jpyRate = data.rates.JPY
    if (jpyRate) {
      if (parts.length > 0) parts.push("  |  ")
      parts.push(`1 USD = ${jpyRate.toFixed(2)} ${currencySymbols.JPY || "JPY"}`)
    }
    setForex(parts.length > 0 ? parts.join("") : "...")
  } catch (e) { console.error("market forex:", e) }
}

interval(240000, () => fetchMarket().catch((e) => console.error("market poll:", e)))
fetchLocation().then(() => fetchMarket().catch((e) => console.error("market init:", e)))

function Cell({ val }: { val: string }) {
  const n = parseFloat(val)
  if (n > 0) return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="positive" label="▲" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label={`${val}%`} xalign={0} />
    </box>
  )
  if (n < 0) return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="negative" label="▼" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label={`${Math.abs(n).toFixed(1)}%`} xalign={0} />
    </box>
  )
  return (
    <box widthRequest={60} spacing={0}>
      <label wrap class="gray2" label="─" xalign={0} widthRequest={12} />
      <label wrap class="gray2" label="0.0%" xalign={0} />
    </box>
  )
}

export default function MarketWidget() {
  return (
    <window visible name="market" class="Market" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="MARKET" />
        <box spacing={5}>
          <label wrap class="accent" label="ASSET" xalign={0} widthRequest={50} />
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1h" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1d" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1w" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1m" xalign={0} />
          </box>
          <box widthRequest={60} spacing={0}>
            <box widthRequest={12} />
            <label wrap class="accent" label="1y" xalign={0} />
          </box>
        </box>
        <box class="hr-line" />
        <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
          <For each={assets}>
            {(item) => (
              <box widthRequest={399} spacing={5}>
                <label ellipsize={3} maxWidthChars={6} wrap xalign={0} class="gray2" label={item.name} widthRequest={50} />
                <Cell val={item.pct1h} />
                <Cell val={item.pct1d} />
                <Cell val={item.pct1w} />
                <Cell val={item.pct1m} />
                <Cell val={item.pct1y} />
              </box>
            )}
          </For>
        </box>
        <box class="hr-line" />
        <label ellipsize={3} maxWidthChars={40} wrap class="gray3" label={createComputed(() => forex())} xalign={0.5} />
      </box>
    </window>
  )
}
