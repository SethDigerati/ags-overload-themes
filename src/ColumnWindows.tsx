import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { rightColumnWidgets, leftColumnWidgets } from "../config"
import { SystemBox } from "./System"
import { CpuBox } from "./Cpu"
import { GpuBox } from "./Gpu"
import { MemoryBox } from "./Memory"
import { NetworkBox } from "./Network"
import { WeatherBox } from "./Weather"
import { LastFmBox } from "./LastFm"
import { MarketBox } from "./Market"
import { QuoteBox } from "./Quote"
import { NewsBox } from "./News"

const { TOP, RIGHT, LEFT } = Astal.WindowAnchor

const widgetMap: Record<string, any> = {
  SystemBox, CpuBox, MemoryBox, GpuBox,
  NetworkBox, LastFmBox, WeatherBox,
  MarketBox, QuoteBox, NewsBox,
}

export const RightCol = () => (
  <window visible name="right-column" class="RightColumn" anchor={TOP | RIGHT} marginRight={0} widthRequest={399} exclusivity={Astal.Exclusivity.NORMAL} layer={Astal.Layer.BOTTOM} application={app} resizable={false}>
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399} spacing={2}>
      {rightColumnWidgets.map(name => {
        const W = widgetMap[name]
        return W ? <W /> : null
      })}
    </box>
  </window>
)

export const LeftCol = () => (
  <window visible name="left-column" class="LeftColumn" anchor={TOP | LEFT} widthRequest={399} exclusivity={Astal.Exclusivity.NORMAL} layer={Astal.Layer.BOTTOM} application={app} resizable={false}>
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399} spacing={2}>
      {leftColumnWidgets.map(name => {
        const W = widgetMap[name]
        return W ? <W /> : null
      })}
    </box>
  </window>
)
