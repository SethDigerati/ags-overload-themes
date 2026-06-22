import { Gtk } from "ags/gtk4"
import { createEffect } from "ags"
import Cairo from "gi://cairo"

export function Levelbar({ value }: { value: () => number }) {
  const area = new Gtk.DrawingArea()
  area.set_size_request(200, 10)
  area.hexpand = true
  area.valign = Gtk.Align.CENTER

  area.set_draw_func((_self: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const v = Math.min(1, Math.max(0, value()))
    const fillW = Math.max(0, v * w)

    if (fillW > 1) {
      const gradient = new Cairo.LinearGradient(0, 0, fillW, 0)
      gradient.addColorStopRGBA(0, 1, 0.878, 0.125, 0)
      gradient.addColorStopRGBA(1, 1, 0.878, 0.125, 1)
      cr.setSource(gradient)
      cr.rectangle(0, 0, fillW, h)
      cr.fill()

      cr.moveTo(fillW, 0)
      cr.lineTo(fillW, h)
      cr.setLineWidth(1.5)
      cr.setSourceRGBA(1, 1, 1, 1)
      cr.stroke()
    }
  })

  createEffect(() => { value(); area.queue_draw() })

  return area
}
