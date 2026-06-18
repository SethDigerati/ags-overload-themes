import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"

import {
  gpuModel, gpuDriver, gpuType, gpuMemUsed, gpuMemTotal, gpuFreqCur, gpuFreqMax, gpuTemp,
} from "../data"
const { TOP, RIGHT } = Astal.WindowAnchor

export default function Gpu() {
  return (
    <window
      visible
      name="gpu"
      class="Gpu"
      anchor={TOP | RIGHT}
      marginRight={0}
      widthRequest={400}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap xalign={0} class="section-header" label={createComputed(() => `GPU (${gpuTemp()}°C)`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Model  : ${gpuModel()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Type   : ${gpuType()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Driver : ${gpuDriver()}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Memory : ${gpuMemUsed() === "N/A" ? `${gpuMemTotal()} (shared)` : `${gpuMemUsed()}/${gpuMemTotal()} MiB`}`)} />
        <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0}
          label={createComputed(() => `Freq   : ${gpuFreqCur()}/${gpuFreqMax()} MHz`)} />
      </box>
    </window>
  )
}
