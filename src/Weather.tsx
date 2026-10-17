import { Gtk } from "ags/gtk4"
import { createState, createComputed, For } from "ags"
import { interval } from "ags/time"
import { fetch } from "ags/fetch"
import Gio from "gi://Gio?version=2.0"
import { env, projectRoot, intervals } from "../config"
import { readFile, writeFile, execAsyncRaw } from "./util"

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

// An explicit city name pinned in .env. WEATHER_NAME is the preferred alias;
// WEATHER_CITY is still honoured because that is what older configs set.
//
// Placeholder values are normalised away to "" so callers can treat "" as "no
// real city pinned":
//   "Custom"  - legacy sentinel this file itself writes when only lat/lon are
//               pinned, so reading it back must not look like a city.
//   "Default" - the literal value carried in shipped .env templates. It is not
//               a place name, and geocoding it would both fail and suppress
//               OWM's municipality refinement for the live city.
const PIN_SENTINELS = new Set(["custom", "default"])

function pinnedCity(): string {
  const v = (env.WEATHER_NAME || env.WEATHER_CITY || "").trim()
  return PIN_SENTINELS.has(v.toLowerCase()) ? "" : v
}

// Every geo-IP provider and OWM itself report the country as an ISO 3166-1
// alpha-2 code ("KE"), which reads badly in the header. Expand it to a full
// name via Intl so the widget shows "Nairobi, Kenya". Values that are already
// full names pass straight through untouched.
function resolveCountry(value: unknown): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  // Only alpha-2 codes need expanding; nothing else is a code.
  if (!/^[A-Za-z]{2}$/.test(raw)) return raw
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(raw.toUpperCase())
    // Verified on this runtime (gjs 1.90.1): an unrecognised code resolves to
    // the literal string "Unknown Region" rather than echoing the code back.
    // Reject it (and any other echo) so the header never reads
    // "Nairobi, Unknown Region" or "Nairobi, KE".
    if (!name || name.length <= 2 || name === "Unknown Region") return ""
    return name
  } catch {
    return ""
  }
}

function seedLocation(): { city: string; country: string } {
  if (env.WEATHER_LAT && env.WEATHER_LON) {
    return { city: pinnedCity() || "Custom", country: "" }
  }
  // Seed the pinned city so a geocoded .env name never flashes "Loading..."
  // while Tier 0 resolves it to coordinates.
  if (pinnedCity()) return { city: pinnedCity(), country: "" }
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

// ── Where-am-i / GeoClue ───────────────────────────────────────────────
// GeoClue's where-am-i is the only "the system knows where I am" source that
// needs no extra service, so try it first. It is not installed on every system
// (it is a hard dependency of nothing here), so every path is allowed to miss
// and we fall through to the next tier.
const WHERE_AM_I = [
  "/usr/lib/geoclue-2.0/demos/where-am-i",
  "/usr/libexec/geoclue-2.0/demos/where-am-i",
  "where-am-i",
]

async function tryGeoclue(): Promise<{ lat: string; lon: string } | null> {
  for (const bin of WHERE_AM_I) {
    // execAsyncRaw resolves {ok:false} rather than throwing when the binary is
    // missing, so a missing candidate is just another miss.
    const { ok, out } = await execAsyncRaw([bin, "-t", "4", "-a", "4"])
    if (!ok || !out) continue
    const latM = out.match(/Latitude:\s*(-?[\d.]+)/i)
    const lonM = out.match(/Longitude:\s*(-?[\d.]+)/i)
    if (latM?.[1] && lonM?.[1]) return { lat: latM[1], lon: lonM[1] }
  }
  return null
}

// ── Connected Wi-Fi BSSID ───────────────────────────────────────────────
// nmcli (NetworkManager) is the better source because it enumerates
// *neighbouring* APs, but it is absent on wpa_supplicant/iwd systems and a raw
// scan needs CAP_NET_ADMIN, so in practice this yields the one AP we are
// currently joined to.
async function connectedBssids(): Promise<Array<{ macAddress: string; signalStrength?: number }>> {
  const aps: Array<{ macAddress: string; signalStrength?: number }> = []

  const nmcli = await execAsyncRaw([
    "nmcli", "-t", "-f", "BSSID,SIGNAL", "dev", "wifi", "list",
  ])
  if (nmcli.ok && nmcli.out) {
    for (const line of nmcli.out.split("\n")) {
      // nmcli -t escapes the colons inside a MAC as "\:"
      const m = line.trim().match(/^([0-9a-f]{2}(?::[0-9a-f]{2}){5}):(-?\d+)/i)
      if (m) {
        aps.push({ macAddress: m[1].toLowerCase(), signalStrength: Number(m[2]) })
        if (aps.length >= 8) break
      }
    }
    if (aps.length) return aps
  }

  const iface = env.WLAN_INTERFACE || "wlan0"
  const link = await execAsyncRaw(["iw", "dev", iface, "link"])
  if (!link.ok) return aps
  const bssid = link.out.match(/Connected to ([0-9a-f:]{17})/i)
  const sig = link.out.match(/signal:\s*(-?\d+)/i)
  if (bssid?.[1]) {
    aps.push({
      macAddress: bssid[1].toLowerCase(),
      signalStrength: sig?.[1] ? Number(sig[1]) : undefined,
    })
  }
  return aps
}

// ── BeaconDB (the open successor to Mozilla Location Service) ──────────
//
// Important: when BeaconDB does not recognise the submitted BSSIDs it does NOT
// fail. It answers 200 with `"fallback": "ipf"` and an IP-derived position that
// is typically tens of kilometres off. Accepting that would print a confident
// "located via Wi-Fi" line while having silently performed the very IP lookup
// this tier exists to avoid, so reject it explicitly.
const BEACONDB_MIN_ACCURACY = 2000   // metres

async function tryWifiPositioning(): Promise<{ lat: string; lon: string } | null> {
  const aps = await connectedBssids()
  if (!aps.length) {
    console.log("weather: no Wi-Fi BSSIDs available for positioning")
    return null
  }
  const data = await safeJson(await fetch("https://beacondb.net/v1/geolocate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wifiAccessPoints: aps }),
  }).catch((e) => {
    console.error("weather: BeaconDB request failed:", e)
    return null
  }))
  if (!data?.location?.lat || !data?.location?.lng) return null

  const bssids = aps.map((a) => a.macAddress).join(" ")
  if (data.fallback === "ipf") {
    console.log("weather: BeaconDB does not know these BSSIDs, ignoring its IP fallback:", bssids)
    return null
  }
  if (typeof data.accuracy === "number" && data.accuracy > BEACONDB_MIN_ACCURACY) {
    console.log("weather: BeaconDB accuracy", data.accuracy, "m is too coarse, rejecting")
    return null
  }
  console.log("weather: BeaconDB matched", bssids, "accuracy", data.accuracy, "m")
  return { lat: String(data.location.lat), lon: String(data.location.lng) }
}

// ── Reverse geocoding: coordinates → the town you are actually in ───────
//
// Use api-bdc.io rather than api.bigdatacloud.net: the latter answers HTTP 307
// redirecting to the former, and `ags/fetch` does not follow redirects (nor does
// Soup.Session, and the wrapper does not even populate response headers), so the
// canonical host would simply fail.
//
// Note on Kenyan addresses: BigDataCloud's `city` is often a ward or estate
// (Narok's resolves to "Olulunga") while `principalSubdivision` is the town the
// user actually means. Pinning WEATHER_NAME remains the deterministic fix.
async function reverseGeocode(
  lat: string, lon: string,
): Promise<{ city: string; country: string } | null> {
  const data = await safeJson(await fetch(
    `https://api-bdc.io/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
  ).catch(() => null))
  if (data?.countryName) {
    const city = data.city || data.locality || data.principalSubdivision
    if (city) return { city, country: data.countryName }
  }

  // OWM's own reverse geocoder as a fallback; it also hands back a refined
  // municipality name for free.
  const owm = await safeJson(await fetch(
    `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`,
  ).catch(() => null))
  if (Array.isArray(owm) && owm[0]?.name) {
    return { city: owm[0].name, country: resolveCountry(owm[0].country) }
  }
  return null
}

// Active location detection. Returns true when usable coordinates are set
// (including from the disk cache), false only when every tier failed.
//
// Order matters: an explicit .env city beats geo-IP, because Kenyan
// cellular/fiber CGNAT routes through regional hubs and a subscriber in Narok
// is routinely reported as a Safaricom hub in Nairobi. The geo-IP tiers are
// ordered by how well they resolve African ISPs first, then by how likely they
// are to answer an unauthenticated call at all.
async function fetchLocation(): Promise<boolean> {
  // Tier 0: .env city name resolved through OWM's geocoder, which turns a name
  // into real coordinates. Handles WEATHER_NAME and WEATHER_CITY alike.
  const pinned = pinnedCity()
  if (pinned) {
    try {
      console.log("weather: resolving .env city via OWM geocoder", pinned)
      const data = await safeJson(await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(pinned)}&limit=1&appid=${API_KEY}`,
      ).catch(() => null))
      if (data?.[0]?.lat && data?.[0]?.lon) {
        const country = resolveCountry(data[0].country)
        console.log("weather: got location (OWM geocoder)", pinned, country)
        persistLocation(pinned, country, String(data[0].lat), String(data[0].lon))
        return true
      }
      console.log("weather: OWM geocoder found nothing for", pinned, "trying geo-IP")
    } catch (e) { console.error("weather OWM geocoder error:", e) }
  }

  // Tier 1: manual lat/lon from .env — no geocoding, no network needed.
  if (env.WEATHER_LAT && env.WEATHER_LON) {
    const lat = String(env.WEATHER_LAT)
    const lon = String(env.WEATHER_LON)
    console.log("weather: using manual override location", lat, lon)
    persistLocation(pinned || "Custom", "", lat, lon)
    return true
  }

  // Tier 2: GeoClue's where-am-i — the desktop location daemon, when present.
  // It reports real coordinates rather than a CGNAT exit point, so it can
  // resolve a subscriber that geo-IP pins to a hub hundreds of km away.
  const geoclue = await tryGeoclue()
  if (geoclue) {
    console.log("weather: got coords from GeoClue", geoclue.lat, geoclue.lon)
    const place = await reverseGeocode(geoclue.lat, geoclue.lon)
    if (place) {
      console.log("weather: got location (GeoClue)", place.city, place.country)
      persistLocation(place.city, place.country, geoclue.lat, geoclue.lon)
      return true
    }
    console.log("weather: GeoClue coords did not reverse-geocode, falling through")
  }

  // Tier 3: Wi-Fi BSSID triangulation via BeaconDB.
  const wifi = await tryWifiPositioning()
  if (wifi) {
    console.log("weather: got coords from Wi-Fi BeaconDB", wifi.lat, wifi.lon)
    const place = await reverseGeocode(wifi.lat, wifi.lon)
    if (place) {
      console.log("weather: got location (Wi-Fi BeaconDB)", place.city, place.country)
      persistLocation(place.city, place.country, wifi.lat, wifi.lon)
      return true
    }
    console.log("weather: BeaconDB coords did not reverse-geocode, falling through")
  }

  // Tier 4: ipwho.is — terminates on the city a Kenyan ISP actually serves
  // more reliably than the commercial databases, and does not 429 anonymous
  // callers. country_code is the ISO code; country is the full name.
  try {
    console.log("weather: fetching location from ipwho.is")
    const data = await safeJson(await fetch("https://ipwho.is/").catch(() => null))
    if (data?.success !== false && data?.latitude && data?.longitude) {
      const country = resolveCountry(data.country_code || data.country)
      console.log("weather: got location (ipwho.is)", data.city, country)
      persistLocation(
        data.city || "Unknown", country,
        String(data.latitude), String(data.longitude),
      )
      return true
    }
    console.log("weather: ipwho.is failed, trying fallback")
  } catch (e) { console.error("weather ipwho.is error:", e) }

  // Tier 5: ip-api.com — plain HTTP, generous quota, good Kenyan city coverage.
  try {
    console.log("weather: fetching location from ip-api.com")
    const data = await safeJson(await fetch("http://ip-api.com/json/").catch(() => null))
    if (data?.status === "success" && data?.latitude && data?.longitude) {
      const country = resolveCountry(data.countryCode || data.country)
      console.log("weather: got location (ip-api.com)", data.city, country)
      persistLocation(
        data.city || "Unknown", country,
        String(data.latitude), String(data.longitude),
      )
      return true
    }
    console.log("weather: ip-api.com failed, trying fallback")
  } catch (e) { console.error("weather ip-api.com error:", e) }

  // Tier 6: ipapi.co — generous free tier.
  try {
    console.log("weather: fetching location from ipapi.co")
    const data = await safeJson(await fetch("https://ipapi.co/json/").catch(() => null))
    if (data?.latitude && data?.longitude) {
      const country = resolveCountry(data.country_code || data.country_name)
      console.log("weather: got location (ipapi.co)", data.city, country)
      persistLocation(
        data.city || "Unknown", country,
        String(data.latitude), String(data.longitude),
      )
      return true
    }
    console.log("weather: ipapi.co failed, trying fallback")
  } catch (e) { console.error("weather ipapi.co error:", e) }

  // Tier 7: freeipapi (note: canonical host is free.freeipapi.com)
  try {
    console.log("weather: fetching location from freeipapi")
    const data = await safeJson(await fetch("https://free.freeipapi.com/api/v1/json").catch(() => null))
    if (data?.latitude && data?.longitude) {
      const country = resolveCountry(data.country_code || data.countryName)
      console.log("weather: got location (freeipapi)", data.cityName, country)
      persistLocation(
        data.cityName || "Unknown", country,
        String(data.latitude), String(data.longitude),
      )
      return true
    }
    console.log("weather: freeipapi failed, trying fallback")
  } catch (e) { console.error("weather freeipapi error:", e) }

  // Tier 8: ipinfo.io — most likely to be rate-limited, so it goes last.
  try {
    console.log("weather: fetching location from ipinfo")
    const data = await safeJson(await fetch("https://ipinfo.io/json").catch(() => null))
    if (data?.city && data?.loc) {
      const [lat, lon] = String(data.loc).split(",")
      if (lat && lon) {
        const country = resolveCountry(data.country_code || data.country)
        console.log("weather: got location (ipinfo)", data.city, country, data.loc)
        persistLocation(data.city || "Unknown", country, lat.trim(), lon.trim())
        return true
      }
    }
    console.log("weather: ipinfo failed, trying fallback")
  } catch (e) { console.error("weather ipinfo error:", e) }

  // Tier 9: last known disk cache — the only non-network fallback. An older
  // cache may hold a bare country code, so normalise it on the way out.
  const cached = loadCachedLocation()
  if (cached) {
    console.log("weather: using cached location", cached.city, cached.lat, cached.lon)
    setLocation({ city: cached.city, country: resolveCountry(cached.country) })
    setLatLon({ lat: cached.lat, lon: cached.lon })
    return true
  }
  console.error("weather: all location tiers failed")
  setLocation({ city: "Location Error", country: "" })
  return false
}

async function fetchWeather() {
  if (!API_KEY) { console.log("weather: no API key"); return }
  if (!latLon().lat) { console.log("weather: no latLon, skipping fetch"); return }
  console.log("weather: fetching weather for", latLon().lat, latLon().lon)
  try {
    const data = await safeJson(await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latLon().lat}&lon=${latLon().lon}&appid=${API_KEY}&units=metric`).catch(() => null))
    if (!data) { console.error("weather: empty/invalid API response"); return }
    if (data.cod === 200) {
      // OpenWeatherMap returns the exact meteorological municipality in
      // data.name and the ISO code in data.sys.country, which is more precise
      // than any IP-geolocation guess. Adopt it unless the user pinned a city
      // by hand. Done before the no-change early return below so the location
      // still resyncs on polls where temperature and description are identical.
      if (data.name && !pinnedCity()) {
        const country = resolveCountry(data.sys?.country) || location().country
        if (data.name !== location().city || country !== location().country) {
          console.log("weather: location synced from OWM", data.name, country)
          setLocation({ city: data.name, country })
        }
      }

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
