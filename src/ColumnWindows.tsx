import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createEffect, createState, type Accessor } from "ags"
import { timeout } from "ags/time"
import { rightColumnWidgets, leftColumnWidgets } from "../config"
import { hwReady } from "../data"
import { SystemBox } from "./System"
import { CpuBox } from "./Cpu"
import { GpuBox } from "./Gpu"
import { MemoryBox } from "./Memory"
import { NetworkBox } from "./Network"
import { WeatherBox, weatherReady } from "./Weather"
import { LastFmBox } from "./LastFm"
import { MarketBox, marketReady } from "./Market"
import { QuoteBox } from "./Quote"
import { NewsBox } from "./News"

const { TOP, RIGHT, LEFT } = Astal.WindowAnchor

const widgetMap: Record<string, any> = {
  SystemBox, CpuBox, MemoryBox, GpuBox,
  NetworkBox, LastFmBox, WeatherBox,
  MarketBox, QuoteBox, NewsBox,
}

// A widget reveals once it is both far enough down the stagger queue and past
// its own first data. Widgets with no signal below fall back to the stagger
// slot alone, so the cascade still reads as a cascade.
const readiness: Record<string, Accessor<boolean> | undefined> = {
  SystemBox: hwReady,
  CpuBox: hwReady,
  MemoryBox: hwReady,
  GpuBox: hwReady,
  NetworkBox: hwReady,
  WeatherBox: weatherReady,
  MarketBox: marketReady,
}

const STAGGER_MS = 60
const REVEAL_MS = 250
const READY_GRACE_MS = 1200

const NEVER: Accessor<boolean> = () => false

function Reveal({ index, name, child }: { index: number; name: string; child: Gtk.Widget }) {
  const ready = readiness[name] ?? NEVER
  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: REVEAL_MS,
    revealChild: false,
  })
  revealer.set_child(child)

  const [done, setDone] = createState(false)

  const at = index * STAGGER_MS
  timeout(at, () => setDone(true))
  // Hard cap so a widget whose data never arrives still shows up.
  timeout(at + READY_GRACE_MS, () => setDone(true))

  createEffect(() => {
    if (ready()) setDone(true)
  })
  createEffect(() => {
    revealer.revealChild = done()
  })

  return revealer
}

function Column({ names, name, anchor, className, marginRight }: {
  names: string[]
  name: string
  anchor: number
  className: string
  marginRight: number
}) {
  return (
    <window visible name={name} class={className} anchor={anchor}
      marginRight={marginRight} widthRequest={399} exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.BOTTOM} application={app} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399} spacing={2}>
        {names.map((widget, i) => {
          const W = widgetMap[widget]
          return W ? <Reveal index={i} name={widget} child={<W />} /> : null
        })}
      </box>
    </window>
  )
}

export const RightCol = () => (
  <Column names={rightColumnWidgets} name="right-column" anchor={TOP | RIGHT} className="RightColumn" marginRight={0} />
)

export const LeftCol = () => (
  <Column names={leftColumnWidgets} name="left-column" anchor={TOP | LEFT} className="LeftColumn" marginRight={0} />
)