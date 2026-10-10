import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import { env, projectRoot } from "../config"

const API_KEY = env.WEATHER_API_KEY || ""
const ICON_DIR = `${projectRoot}/assets/icons/`

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                   "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"]

const [location, setLocation] = createState({ city: "Loading...", country: "" })
const [latLon, setLatLon] = createState({ lat: "", lon: "" })
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

async function fetchLocation() {
  try {
    console.log("weather: fetching location from ipinfo")
    const res = await fetch("https://ipinfo.io/json")
    const data = await res.json()
    if (!data || !data.city) {
      throw new Error("Invalid ipinfo response: " + JSON.stringify(data))
    }
    console.log("weather: got location", data.city, data.country, data.loc)
    setLocation({ city: data.city || "Unknown", country: data.country || "" })
    if (data.loc) { const [lat, lon] = data.loc.split(","); setLatLon({ lat, lon }) }
  } catch (e) {
    console.error("weather ipinfo error:", e)
    setLocation({ city: "Location Error", country: "" })
  }
}

async function fetchWeather() {
  if (!API_KEY) { console.log("weather: no API key"); return }
  if (!latLon().lat) { console.log("weather: no latLon, skipping fetch"); return }
  console.log("weather: fetching weather for", latLon().lat, latLon().lon)
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`)
    const data = await res.json()
    if (data.cod === 200) {
      const w = data.weather[0]
      const isDay = w.icon.endsWith("d")
      const windDeg = data.wind.deg || 0
      console.log("weather: got data", data.main.temp, w.description)
      if (`${Math.round(data.main.temp)}|${w.description.replace(/\b\w/g, (c: string) => c.toUpperCase())}`
          === `${weather().temp}|${weather().description}`) return
      setWeather({
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
    } else {
      console.error("weather: API returned error", data.cod, data.message)
    }
  } catch (e) { console.error("weather fetch error:", e) }
}

async function fetchForecast() {
  if (!API_KEY || !latLon().lat) { console.log("weather: no latLon for forecast"); return }
  console.log("weather: fetching forecast")
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`)
    const data = await res.json()
    if (!data.list) { console.error("weather: forecast no list", data); return }
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

interval(600000, () => { fetchWeather().catch((e) => console.error("weather poll:", e)); fetchForecast().catch((e) => console.error("forecast poll:", e)) })
fetchLocation().then(() => { fetchWeather(); fetchForecast() }).catch((e) => console.error("weather location:", e))

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
