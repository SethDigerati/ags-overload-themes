import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"

import {
  gpuModel, gpuDriver, gpuType, gpuMemUsed, gpuMemTotal, gpuFreqCur, gpuFreqMax, gpuTemp,
} from "../data"

const gpuLabels = ["Model : ", "Type : ", "Driver : ", "Memory : ", "Frequency : "]
const gpuFieldWidth = Math.max(...gpuLabels.map(l => l.length)) * 7 + 10

export function GpuBox() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399} overflow={Gtk.Overflow.HIDDEN}>
      <label wrap xalign={0} ellipsize={3} maxWidthChars={50} class="section-header" label={createComputed(() => `GPU (${gpuTemp()}°C)`)} />
      <box class="hr-line" />
      <box>
        <label class="accent" xalign={1} widthRequest={gpuFieldWidth} label="Model : " />
        <box widthRequest={250}>
          <label ellipsize={3} wrap maxWidthChars={35} class="gray2" xalign={0} hexpand
            label={createComputed(() => gpuModel())} />
        </box>
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={gpuFieldWidth} label="Type : " />
        <label ellipsize={3} maxWidthChars={50} class="gray2" xalign={0} hexpand
          label={createComputed(() => gpuType())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={gpuFieldWidth} label="Driver : " />
        <label ellipsize={3} maxWidthChars={50} class="gray2" xalign={0} hexpand
          label={createComputed(() => gpuDriver())} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={gpuFieldWidth} label="Memory : " />
        <label ellipsize={3} maxWidthChars={50} class="gray2" xalign={0} hexpand
          label={createComputed(() => gpuMemUsed() === "N/A" ? `${gpuMemTotal()} (shared)` : `${gpuMemUsed()}/${gpuMemTotal()} MiB`)} />
      </box>
      <box>
        <label class="accent" xalign={1} widthRequest={gpuFieldWidth} label="Frequency : " />
        <label ellipsize={3} maxWidthChars={50} class="gray2" xalign={0} hexpand
          label={createComputed(() => `${gpuFreqCur()}/${gpuFreqMax()} MHz`)} />
      </box>
    </box>
  )
}
