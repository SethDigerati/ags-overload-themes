import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { createPoll } from "ags/time"
import { kernel, uptime, nodename, batteryPerc, batteryStatus } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

const weekday = createPoll("", 60000, "date '+%A'")
const timeStr = createPoll("", 1000, "date '+%H:%M'")
const dateStr = createPoll("", 86400000, "date '+%B %d, %Y'")

export default function System() {
  return (
    <window visible name="system" class="System" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={400}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap class="section-header" label="SYSTEM" />
        <label wrap class="weekday" label={weekday} xalign={1} />
        <label wrap class="clock-large" label={timeStr} xalign={1} />
        <label wrap class="date-large" label={dateStr} xalign={1} />
        <label wrap class="gray1" label={createComputed(() => `${kernel()} | ${uptime()}`)} xalign={1} />
        <label wrap class="gray1" label={createComputed(() => nodename())} xalign={1} />
        <label wrap class="section-header" label="BATTERY" />
        <label wrap class="gray1" label={createComputed(() => {
          const p = batteryPerc()
          return p < 0 ? "No battery" : `${batteryStatus()} (${p}%)`
        })} xalign={1} />
      </box>
    </window>
  )
}
