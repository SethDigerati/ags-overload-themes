import { readFile } from "./src/util"
import GLib from "gi://GLib?version=2.0"

export const projectRoot = GLib.get_current_dir()

export const colors = {
  yellow: "#FFE020",
  orange: "#EF5A29",
  green: "#77B753",
  red: "#FF0000",
  white: "#FFFFFF",
  gray1: "#EAEAEA",
  gray2: "#AAAAAA",
  gray3: "#888888",
  black: "#000000",
}

export const intervals = {
  system: 1000,
  network: 2000,
  weather: 600000,
  lastfm: 2000,
  market: 240000,
  news: 300000,
  quote: 3600000,
}

export const margins = {
  topRight: { marginTop: 10, marginRight: 0 },
  topLeft: { marginTop: 10, marginLeft: 0 },
  bottomLeft: { marginBottom: 10, marginLeft: 0 },
}

export function loadEnv(): Record<string, string> {
  const content = readFile(`${projectRoot}/.env`)
  if (!content) return {}
  const env: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.replace(/#.*$/, "").trim()
    if (!trimmed || !trimmed.includes("=")) continue
    const idx = trimmed.indexOf("=")
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    val = val.replace(/^['"]|['"]$/g, "")
    env[key] = val
  }
  return env
}

export const env = loadEnv()

export const defaultInterface = "wlan0"
