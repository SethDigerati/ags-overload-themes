import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed } from "ags"
import {
  netIface, netStatus, netSSID, netBitrate, netSignal,
  netDownSpeed, netUpSpeed, netDownTotal, netUpTotal,
  netLocalIp, netLatency, netLoss, netJitter,
  formatSpeed,
} from "../data"

const { TOP, RIGHT } = Astal.WindowAnchor

const netLabels = ["Status : ", "SSID : ", "Signal : ", "Local IP : ", "Down : ", "Up : ", "Total DL : ", "Total UL : "]
const netFieldWidth = Math.max(...netLabels.map(l => l.length)) * 7 + 10

export default function Network() {
  return (
    <window
      visible
      name="network"
      class="Network"
      anchor={TOP | RIGHT}
      marginTop={10}
      marginLeft={0}
      widthRequest={399}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
      resizable={false}
    >
      <box orientation={Gtk.Orientation.VERTICAL} widthRequest={399}>
        <label wrap xalign={0} ellipsize={3} maxWidthChars={50} class="section-header" label={createComputed(() => `NETWORK(${netIface()})`)} />
        <box class="hr-line" />
        <box>
          <label class="accent" label="Status : " widthRequest={netFieldWidth} xalign={1} />
          <label ellipsize={3} maxWidthChars={50} wrap hexpand xalign={0}
            label={createComputed(() => netStatus())}
            cssClasses={createComputed(() => [netStatus() === "ONLINE" ? "positive" : "negative"])} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="SSID : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => netSSID())} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Signal : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => `${netSignal()}%`)} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Local IP : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => netLocalIp())} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Down : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => formatSpeed(netDownSpeed()))} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Up : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => formatSpeed(netUpSpeed()))} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Total DL : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => netDownTotal())} />
        </box>
        <box>
          <label class="accent" xalign={1} widthRequest={netFieldWidth} label="Total UL : " />
          <label ellipsize={3} maxWidthChars={50} wrap class="gray2" xalign={0} hexpand
            label={createComputed(() => netUpTotal())} />
        </box>
      </box>
    </window>
  )
}
