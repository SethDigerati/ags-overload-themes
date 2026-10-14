import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import Gio from "gi://Gio?version=2.0"
import { env, projectRoot } from "../config"
import { readFile, writeFile } from "./util"

const API_KEY = env.WEATHER_API_KEY || ""
const ICON_DIR = `${projectRoot}/assets/icons/`
const LOCATION_CACHE = "/tmp/ags/weather/location.json"

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                   "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"]

function loadCachedLocation(): { city: string; country: string; lat: string; lon: string } | null {
  try {
    const raw = readFile(LOCATION_CACHE)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data && data.lat && data.lon) {
      return {
        city: data.city || "Cached",
        country: data.country || "",
        lat: String(data.lat),
        lon: String(data.lon),
      }
    }
  } catch { /* ignore corrupt cache */ }
  return null
}

function seedLocation(): { city: string; country: string } {
  if (env.WEATHER_LAT && env.WEATHER_LON) {
    return { city: env.WEATHER_CITY || "Custom", country: "" }
  }
  return loadCachedLocation() ?? { city: "Loading...", country: "" }
}

function seedLatLon(): { lat: string; lon: string } {
  if (env.WEATHER_LAT && env.WEATHER_LON) {
    return { lat: String(env.WEATHER_LAT), lon: String(env.WEATHER_LON) }
  }
  const cached = loadCachedLocation()
  if (cached) return { lat: cached.lat, lon: cached.lon }
  return { lat: "", lon: "" }
}

const [location, setLocation] = createState(seedLocation())
const [latLon, setLatLon] = createState(seedLatLon())
export const [weatherReady, setWeatherReady] = createState(false)
const [weather, setWeather] = createState({
  temp: "N/A", tempMin: "N/A", tempMax: "N/A",
  humidity: "N/A", pressure: "N/A", description: "Unknown",
  windSpeed: "N/A", windDir: "", windDirIcon: "",
  visibility: "N/A", precipitation: "0", pop: "0",
  icon: "clearsky_day", updateTime: "N/A",
})
const [forecast, setForecast] = createState<Array<{
  day: string; desc: string; temp: string; humidity: string;
  wind: string; precip: string; pop: string;
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

async function safeJson(res: any): Promise<any> {
  if (!res || res.ok === false) return null
  try {
    const text = await res.text()
    if (!text || !text.trim().startsWith("{")) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

function persistLocation(city: string, country: string, lat: string, lon: string) {
  setLocation({ city, country })
  setLatLon({ lat, lon })
  try {
    writeFile(LOCATION_CACHE, JSON.stringify({ city, country, lat, lon }))
  } catch (e) { console.error("weather cache write:", e) }
}

async function fetchLocation() {
  // Tier 0: manual override from .env — no network needed
  if (env.WEATHER_LAT && env.WEATHER_LON) {
    const lat = String(env.WEATHER_LAT)
    const lon = String(env.WEATHER_LON)
    console.log("weather: using manual override location", lat, lon)
    persistLocation(env.WEATHER_CITY || "Custom", "", lat, lon)
    return
  }
  // Tier 1: ipinfo.io
  try {
    console.log("weather: fetching location from ipinfo")
    const data = await safeJson(await fetch("https://ipinfo.io/json").catch(() => null))
    if (data?.city && data?.loc) {
      const [lat, lon] = String(data.loc).split(",")
      if (lat && lon) {
        console.log("weather: got location (ipinfo)", data.city, data.country, data.loc)
        persistLocation(data.city || "Unknown", data.country || "", lat.trim(), lon.trim())
        return
      }
    }
    console.log("weather: ipinfo failed, trying fallback")
  } catch (e) { console.error("weather ipinfo error:", e) }
  // Tier 2: freeipapi (note: canonical host is free.freeipapi.com)
  try {
    console.log("weather: fetching location from freeipapi")
    const data = await safeJson(await fetch("https://free.freeipapi.com/api/v1/json").catch(() => null))
    if (data?.latitude && data?.longitude) {
      console.log("weather: got location (freeipapi)", data.cityName, data.countryName)
      persistLocation(
        data.cityName || "Unknown", data.countryName || "",
        String(data.latitude), String(data.longitude),
      )
      return
    }
    console.log("weather: freeipapi failed, trying fallback")
  } catch (e) { console.error("weather freeipapi error:", e) }
  // Tier 3: ipapi.co
  try {
    console.log("weather: fetching location from ipapi.co")
    const data = await safeJson(await fetch("https://ipapi.co/json/").catch(() => null))
    if (data?.latitude && data?.longitude) {
      console.log("weather: got location (ipapi.co)", data.city, data.country_name)
      persistLocation(
        data.city || "Unknown", data.country_name || "",
        String(data.latitude), String(data.longitude),
      )
      return
    }
    console.log("weather: ipapi.co failed, trying fallback")
  } catch (e) { console.error("weather ipapi.co error:", e) }
  // Tier 3b: ipwho.is (same shape, generous free tier)
  try {
    console.log("weather: fetching location from ipwho.is")
    const data = await safeJson(await fetch("https://ipwho.is/").catch(() => null))
    if (data?.success !== false && data?.latitude && data?.longitude) {
      console.log("weather: got location (ipwho.is)", data.city, data.country)
      persistLocation(
        data.city || "Unknown", data.country || "",
        String(data.latitude), String(data.longitude),
      )
      return
    }
    console.log("weather: ipwho.is failed, trying cache")
  } catch (e) { console.error("weather ipwho.is error:", e) }
  // Tier 4: last known disk cache
  const cached = loadCachedLocation()
  if (cached) {
    console.log("weather: using cached location", cached.city, cached.lat, cached.lon)
    setLocation({ city: cached.city, country: cached.country })
    setLatLon({ lat: cached.lat, lon: cached.lon })
    return
  }
  console.error("weather: all location tiers failed")
  setLocation({ city: "Location Error", country: "" })
}

async function fetchWeather() {
  if (!API_KEY) { console.log("weather: no API key"); return }
  if (!latLon().lat) { console.log("weather: no latLon, skipping fetch"); return }
  console.log("weather: fetching weather for", latLon().lat, latLon().lon)
  try {
    const data = await safeJson(await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`).catch(() => null))
    if (!data) { console.error("weather: empty/invalid API response"); return }
    if (data.cod === 200) {
      const w = data.weather[0]
      const isDay = w.icon.endsWith("d")
      const windDeg = data.wind.deg || 0
      console.log("weather: got data", data.main.temp, w.description)
      if (`${Math.round(data.main.temp)}|${w.description.replace(/\b\w/g, (c: string) => c.toUpperCase())}`
          === `${weather().temp}|${weather().description}`) {
        if (weather().temp !== "N/A") setWeatherReady(true)
        return
      }
      setWeather({
        ...weather(),
        temp: Math.round(data.main.temp).toString(),
        tempMin: Math.round(data.main.temp_min).toString(),
        tempMax: Math.round(data.main.temp_max).toString(),
        humidity: data.main.humidity.toString(),
        pressure: data.main.pressure.toString(),
        description: w.description.replace(/\b\w/g, (c: string) => c.toUpperCase()),
        windSpeed: (data.wind.speed * 3.6).toFixed(1),
        windDir: CARDINALS[Math.round(windDeg / 22.5) % 16],
        windDirIcon: ARROWS[Math.round(windDeg / 45) % 8],
        visibility: (data.visibility / 1000).toFixed(1),
        precipitation: ((data.rain && (data.rain["1h"] || data.rain["3h"])) || 0).toString(),
        icon: mapWeatherIcon(w.id, isDay),
        updateTime: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      })
      setWeatherReady(true)
    } else {
      console.error("weather: API returned error", data.cod, data.message)
    }
  } catch (e) { console.error("weather fetch error:", e) }
}

async function fetchForecast() {
  if (!API_KEY || !latLon().lat) { console.log("weather: no latLon for forecast"); return }
  console.log("weather: fetching forecast")
  try {
    const data = await safeJson(await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`).catch(() => null))
    if (!data?.list) { console.error("weather: forecast no list", data); return }
    console.log("weather: got forecast", data.list.length, "entries")

    const todayPop = data.list[0] ? Math.round((data.list[0].pop || 0) * 100).toString() : "0"
    setWeather({ ...weather(), pop: todayPop })

    const days: Record<string, any> = {}
    for (const item of data.list) {
      const date = item.dt_txt.split(" ")[0]
      if (!days[date]) days[date] = { tempMin: 99, tempMax: -99, humidity: 0, wind: 0, precip: 0, pop: 0, count: 0, desc: "", icon: "" }
      days[date].tempMin = Math.min(days[date].tempMin, item.main.temp_min)
      days[date].tempMax = Math.max(days[date].tempMax, item.main.temp_max)
      days[date].humidity += item.main.humidity
      days[date].wind += (item.wind.speed || 0) * 3.6
      days[date].precip += (item.rain && item.rain["3h"]) || 0
      days[date].pop = Math.max(days[date].pop, (item.pop || 0) * 100)
      days[date].count++
      const isDay = item.weather[0].icon.endsWith("d")
      if (item.dt_txt.includes("12:00")) {
        days[date].desc = item.weather[0].description.replace(/\b\w/g, (c: string) => c.toUpperCase())
        days[date].icon = mapWeatherIcon(item.weather[0].id, isDay)
      }
    }
    const newForecast = Object.entries(days).slice(1, 6).map(([date, d]: [string, any]) => ({
      day: new Date(date).toLocaleDateString("en", { weekday: "short" }),
      temp: `${Math.round(d.tempMin)}-${Math.round(d.tempMax)}`,
      desc: d.desc || "N/A",
      humidity: Math.round(d.humidity / d.count).toString(),
      wind: (d.wind / d.count).toFixed(1),
      precip: d.precip.toFixed(1),
      pop: Math.round(d.pop).toString(),
    }))
    if (forecast().length === newForecast.length &&
        newForecast.every((f, i) => f.day === forecast()[i].day && f.temp === forecast()[i].temp))
      return
    setForecast(newForecast)
  } catch (e) { console.error("weather forecast:", e) }
}

async function updateWeather() {
  if (!latLon().lat) {
    await fetchLocation()
  }
  if (latLon().lat) {
    await Promise.all([fetchWeather(), fetchForecast()])
  }
}

interval(600000, () => { updateWeather().catch((e) => console.error("weather poll:", e)) })
Gio.NetworkMonitor.get_default()?.connect("network-changed", (_m: any, online: boolean) => {
  if (!online) return
  updateWeather().catch((e) => console.error("weather reconnect:", e))
})
updateWeather().catch((e) => console.error("weather location:", e))

export function WeatherBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="WEATHER" />
      <box class="hr-line" />
      <box>
        <label ellipsize={3} maxWidthChars={30} wrap class="gray1" hexpand xalign={0}
          label={createComputed(() => { const l = location(); return `${l.city}${l.country ? `, ${l.country}` : ""}` })} />
        <label ellipsize={3} maxWidthChars={20} class="gray2 moon-name" label={createComputed(() => moon().name)} />
        <label ellipsize={3} maxWidthChars={3} class="moon-icon" label={createComputed(() => moon().icon)} />
      </box>
      <label ellipsize={3} maxWidthChars={40} wrap xalign={0} class="weather-desc" label={createComputed(() => weather().description)} />
      <box>
        <box class="weather-row">
          <image class="weather-icon" marginStart={10} file={createComputed(() => `${ICON_DIR}${weather().icon}.png`)} pixelSize={100} />
          <label maxWidthChars={8} class="weather-temp" label={createComputed(() => `${weather().temp}°C`)} xalign={0} />
        </box>
          <box marginStart={15} orientation={Gtk.Orientation.VERTICAL}>
          <box>
            <label class="accent" label="TEMP: " />
            <label ellipsize={3} maxWidthChars={15} label={createComputed(() => `${weather().tempMin}-${weather().tempMax}°C`)} />
          </box>
          <box>
            <label class="accent" label="PRECIPITATION: " />
            <label ellipsize={3} maxWidthChars={10} label={createComputed(() => `${weather().precipitation} mm`)} />
            <label hexpand />
            <label class="accent" label="ODDS: " />
            <label ellipsize={3} maxWidthChars={6} label={createComputed(() => `${weather().pop}%`)} />
          </box>
          <box>
            <label class="accent" label="HUMIDITY: " />
            <label ellipsize={3} maxWidthChars={6} label={createComputed(() => `${weather().humidity}%`)} />
          </box>
          <box>
            <label class="accent" label="PRESSURE: " />
            <label ellipsize={3} maxWidthChars={10} label={createComputed(() => `${weather().pressure} hPa`)} />
          </box>
          <box>
            <label class="accent" label="WINDS: " />
            <label ellipsize={3} maxWidthChars={10} label={createComputed(() => `${weather().windSpeed} km/h`)} />
            <label hexpand />
            <label class="accent" label="DIRECTION: " />
            <label ellipsize={3} maxWidthChars={10} label={createComputed(() => `${weather().windDirIcon} ${weather().windDir}`)} />
          </box>
          <box>
            <label class="accent" label="VISIBILITY: " />
            <label ellipsize={3} maxWidthChars={10} label={createComputed(() => `${weather().visibility} km`)} />
          </box>
        </box>
      </box>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <label wrap xalign={0} class="section-header" label="5-DAY FORECAST" />
        <box class="hr-line" />
        <box class="forecast-header">
          <label class="accent" label="Day" widthRequest={50} xalign={0} />
          <label class="accent weather-col" label="Weather" widthRequest={100} xalign={0} />
          <label class="accent temp-col" label="Temp" widthRequest={55} xalign={0} />
          <label class="accent hmd-col" label="Hmd" widthRequest={50} xalign={0} />
          <label class="accent wind-col" label="Wind" widthRequest={55} xalign={0} />
          <label class="accent prec-col" label="Prec" widthRequest={55} xalign={0} />
          <label class="accent" label="Rain%" xalign={1} hexpand />
        </box>
        <box class="hr-line" />
        <For each={forecast}>
          {(item) => (
            <box>
              <label ellipsize={3} maxWidthChars={5} label={item.day} widthRequest={50} xalign={0} />
              <label class="gray2 weather-col" ellipsize={3} maxWidthChars={15} label={item.desc} widthRequest={100} xalign={0} />
              <label ellipsize={3} maxWidthChars={8} class="temp-col" label={`${item.temp}°C`} widthRequest={55} xalign={0} />
              <label ellipsize={3} maxWidthChars={5} class="hmd-col" label={`${item.humidity}%`} widthRequest={50} xalign={0} />
              <label ellipsize={3} maxWidthChars={8} class="wind-col" label={`${item.wind}km/h`} widthRequest={55} xalign={0} />
              <label ellipsize={3} maxWidthChars={6} class="prec-col" label={`${item.precip}mm`} widthRequest={55} xalign={0} />
              <label ellipsize={3} maxWidthChars={5} label={`${item.pop}%`} xalign={1} hexpand />
            </box>
          )}
        </For>
      </box>
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={30} class="green" label={createComputed(() => `Last Update: ${weather().updateTime}`)} xalign={0} />
    </box>
  )
}
