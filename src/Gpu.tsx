import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"

import {
  gpuModel, gpuDriver, gpuType, gpuMemUsed, gpuMemTotal, gpuFreqCur, gpuFreqMax, gpuTemp, kernel,
} from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

export default function Gpu() {
  return (
    <window
      visible
      name="gpu"
      class="Gpu"
      anchor={TOP | RIGHT}
      marginTop={680}
      marginRight={0}
      widthRequest={400}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={400}>
        <label wrap class="section-header" label={createComputed(() => `GPU (${gpuTemp()}°C)`)} />
        <box>
          <label wrap class="gray2" label="Model:" widthRequest={60} />
          <label wrap maxWidthChars={45} label={createComputed(() => gpuModel())} class="gray2" xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Type:" widthRequest={60} />
          <label wrap label={createComputed(() => gpuType())} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Driver:" widthRequest={60} />
          <label wrap label={createComputed(() => gpuDriver())} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Memory:" widthRequest={60} />
          <label wrap label={createComputed(() => `${gpuMemUsed()}/${gpuMemTotal()} MB`)} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Freq:" widthRequest={60} />
          <label wrap label={createComputed(() => `${gpuFreqCur()}/${gpuFreqMax()} MHz`)} xalign={1} />
        </box>
        <box>
          <label wrap class="gray2" label="Driver Ver:" widthRequest={60} />
          <label wrap label={createComputed(() => kernel())} xalign={1} />
        </box>
      </box>
    </window>
  )
}
