import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import { createPoll } from "ags/time"
import { kernel, uptime, batteryPerc, batteryStatus, batteryTech, batteryEnergy, batteryEnergyFull, batteryTime } from "../data"

const weekday = createPoll("", 60000, "date '+%A'")
const timeStr = createPoll("", 1000, "date '+%H:%M'")
const dateStr = createPoll("", 86400000, "date '+%B %d'")

export function SystemBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
      <label wrap xalign={0} class="section-header" label="SYSTEM" />
      <box class="hr-line" />
      <box>
        <label ellipsize={3} maxWidthChars={7} wrap class="weekday" label={weekday} xalign={0} hexpand />
        <box orientation={Gtk.Orientation.VERTICAL}>
          <label ellipsize={3} maxWidthChars={12} wrap class="date-large" label={dateStr} xalign={1} valign={Gtk.Align.START} />
          <label wrap ellipsize={3} maxWidthChars={8} class="clock-large" label={timeStr} xalign={1} valign={Gtk.Align.END} />
        </box>
      </box>
      <box>
        <label ellipsize={3} maxWidthChars={30} wrap class="gray1" label={kernel} xalign={0} hexpand />
        <label ellipsize={3} maxWidthChars={30} wrap class="gray1" label={uptime} xalign={1} />
      </box>
      <label wrap xalign={0} class="section-header" label="BATTERY" />
      <box class="hr-line" />
      <label ellipsize={3} maxWidthChars={50} wrap class="gray1" label={createComputed(() => {
        const p = batteryPerc()
        return p < 0 ? "No battery" : `${batteryStatus()} (${p}%) | ${batteryTech()} | ${batteryEnergy()}/${batteryEnergyFull()} Wh | ${batteryTime()}`
      })} xalign={0} />
    </box>
  )
}
