import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env, projectRoot } from "../config"

const { TOP, LEFT } = Astal.WindowAnchor
const API_KEY = env.WEATHER_API_KEY || ""
const ICON_DIR = `${projectRoot}/assets/icons/`

const [location, setLocation] = createState({ city: "Loading...", country: "" })
const [latLon, setLatLon] = createState({ lat: "", lon: "" })
const [weather, setWeather] = createState({
  temp: "N/A", tempMin: "N/A", tempMax: "N/A",
  humidity: "N/A", pressure: "N/A", description: "Unknown",
  windSpeed: "N/A", visibility: "N/A", icon: "clearsky_day",
})
const [forecast, setForecast] = createState<Array<{
  date: string; temp: string; desc: string; icon: string
}>>([])

function mapWeatherIcon(code: number, isDay: boolean): string {
  const suffix = isDay ? "day" : "night"
  if (code >= 200 && code < 300) {
    if (code <= 202 || code >= 230) return "heavyrainandthunder"
    return "rainandthunder"
  }
  if (code >= 300 && code < 400) return "lightrain"
  if (code >= 500 && code < 600) {
    if (code <= 504) return code < 502 ? "rain" : "heavyrain"
    if (code === 511) return "sleet"
    if (code <= 522) return code < 522 ? `rainshowers_${suffix}` : `heavyrainshowers_${suffix}`
    return `rainshowers_${suffix}`
  }
  if (code >= 600 && code < 700) {
    if (code <= 602) return code < 601 ? "lightsnow" : code < 602 ? "snow" : "heavysnow"
    if (code <= 616) return "sleet"
    return code < 622 ? `snowshowers_${suffix}` : `heavysnowshowers_${suffix}`
  }
  if (code >= 700 && code < 800) return "fog"
  if (code === 800) return `clearsky_${suffix}`
  if (code >= 801 && code < 900) {
    if (code <= 802) return `partlycloudy_${suffix}`
    return "cloudy"
  }
  return "clearsky_day"
}

const moon = createComputed(() => {
  const phases = [
    { name: "New Moon", icon: "\u{1F311}" }, { name: "Waxing Crescent", icon: "\u{1F312}" },
    { name: "First Quarter", icon: "\u{1F313}" }, { name: "Waxing Gibbous", icon: "\u{1F314}" },
    { name: "Full Moon", icon: "\u{1F315}" }, { name: "Waning Gibbous", icon: "\u{1F316}" },
    { name: "Last Quarter", icon: "\u{1F317}" }, { name: "Waning Crescent", icon: "\u{1F318}" },
  ]
  const knownNewMoon = 947182440
  const lunarCycle = 29.53058867 * 86400
  const idx = Math.round(((Date.now() / 1000 - knownNewMoon) / lunarCycle % 1) * 8) % 8
  return phases[idx]
})

async function fetchLocation() {
  try {
    const res = await fetch("https://ipinfo.io/json")
    const data = await res.json()
    setLocation({ city: data.city || "Unknown", country: data.country || "" })
    if (data.loc) { const [lat, lon] = data.loc.split(","); setLatLon({ lat, lon }) }
  } catch (e) { console.error("weather ipinfo:", e) }
}

async function fetchWeather() {
  if (!API_KEY || !latLon().lat) return
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`)
    const data = await res.json()
    if (data.cod === 200) {
      const w = data.weather[0]
      const isDay = w.icon.endsWith("d")
      setWeather({
        temp: Math.round(data.main.temp).toString(),
        tempMin: Math.round(data.main.temp_min).toString(),
        tempMax: Math.round(data.main.temp_max).toString(),
        humidity: data.main.humidity.toString(),
        pressure: data.main.pressure.toString(),
        description: w.description.replace(/\b\w/g, (c: string) => c.toUpperCase()),
        windSpeed: (data.wind.speed * 3.6).toFixed(1),
        visibility: (data.visibility / 1000).toFixed(1),
        icon: mapWeatherIcon(w.id, isDay),
      })
    }
  } catch (e) { console.error("weather fetch:", e) }
}

async function fetchForecast() {
  if (!API_KEY || !latLon().lat) return
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`)
    const data = await res.json()
    if (!data.list) return
    const days: Record<string, any> = {}
    for (const item of data.list) {
      const date = item.dt_txt.split(" ")[0]
      if (!days[date]) days[date] = { tempMin: 99, tempMax: -99, count: 0, desc: "", icon: "" }
      days[date].tempMin = Math.min(days[date].tempMin, item.main.temp_min)
      days[date].tempMax = Math.max(days[date].tempMax, item.main.temp_max)
      days[date].count++
      const isDay = item.weather[0].icon.endsWith("d")
      if (item.dt_txt.includes("12:00")) {
        days[date].desc = item.weather[0].description.replace(/\b\w/g, (c: string) => c.toUpperCase())
        days[date].icon = mapWeatherIcon(item.weather[0].id, isDay)
      }
    }
    setForecast(Object.entries(days).slice(0, 5).map(([date, d]) => ({
      date: new Date(date).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
      temp: `${Math.round(d.tempMin)}-${Math.round(d.tempMax)}`,
      desc: d.desc || "N/A",
      icon: d.icon || "cloudy",
    })))
  } catch (e) { console.error("weather forecast:", e) }
}

interval(600000, () => { fetchWeather().catch((e) => console.error("weather poll:", e)); fetchForecast().catch((e) => console.error("forecast poll:", e)) })
fetchLocation().then(() => { fetchWeather(); fetchForecast() }).catch((e) => console.error("weather location:", e))

export default function WeatherWidget() {
  return (
    <window visible name="weather" class="Weather" anchor={TOP | LEFT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <label wrap class="section-header" label="WEATHER" />
        <label wrap class="gray1" label={createComputed(() => { const l = location(); return `${l.city}${l.country ? `, ${l.country}` : ""}` })} xalign={1} />
        <box>
          <image file={createComputed(() => `${ICON_DIR}${weather().icon}.png`)} pixelSize={100} />
          <label wrap class="clock-large" label={createComputed(() => `${weather().temp}°C`)} xalign={0} />
          <box orientation={Gtk.Orientation.VERTICAL} hexpand halign={Gtk.Align.END}>
            <label wrap xalign={1} label={createComputed(() => weather().description)} />
            <label wrap xalign={1} label={createComputed(() => `H: ${weather().tempMax}° L: ${weather().tempMin}°`)} />
          </box>
        </box>
        <label wrap class="gray2" xalign={1}
          label={createComputed(() => `Humidity: ${weather().humidity}% | Pressure: ${weather().pressure} hPa`)} />
        <label wrap class="gray2" xalign={1}
          label={createComputed(() => `Wind: ${weather().windSpeed} km/h | Vis: ${weather().visibility} km`)} />
        <label wrap xalign={1} label={createComputed(() => { const m = moon(); return `${m.icon} ${m.name}` })} />
        <label wrap class="section-header" label="5-DAY FORECAST" />
        <For each={forecast}>
          {(item) => (
            <box>
              <label wrap label={item.date} widthRequest={100} />
              <label wrap class="gray2" label={item.desc} hexpand xalign={0} />
              <label wrap label={`${item.temp}°C`} xalign={1} widthRequest={70} />
            </box>
          )}
        </For>
      </box>
    </window>
  )
}
