import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { createPoll } from "ags/time"
import { kernel, uptime, batteryPerc, batteryStatus, batteryTech, batteryEnergy, batteryEnergyFull, batteryTime } from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

const weekday = createPoll("", 60000, "date '+%A'")
const timeStr = createPoll("", 1000, "date '+%H:%M'")
const dateStr = createPoll("", 86400000, "date '+%B %d, %Y'")

export default function System() {
  return (
    <window visible name="system" class="System" anchor={TOP | RIGHT} exclusivity={Astal.Exclusivity.NORMAL} application={app} widthRequest={399} resizable={false}>
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} class="section-header" label="SYSTEM" />
        <box class="hr-line" />
        <box>
          <label ellipsize={3} maxWidthChars={7} wrap class="weekday" label={weekday} xalign={0} />
          <label wrap ellipsize={3} maxWidthChars={8} class="clock-large" label={timeStr} xalign={1} hexpand />
        </box>
        <box>
          <label ellipsize={3} maxWidthChars={25} wrap class="date-large" label={dateStr} xalign={0} />
          <label ellipsize={3} maxWidthChars={30} wrap class="gray1" label={createComputed(() => `${kernel()} | ${uptime()}`)} xalign={1} hexpand />
        </box>
        <label wrap xalign={0} class="section-header" label="BATTERY" />
        <box class="hr-line" />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray1" label={createComputed(() => {
          const p = batteryPerc()
          return p < 0 ? "No battery" : `${batteryStatus()} (${p}%) | ${batteryTech()} | ${batteryEnergy()}/${batteryEnergyFull()} Wh | ${batteryTime()}`
        })} xalign={0} />
      </box>
    </window>
  )
}
