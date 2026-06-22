import { Gtk } from "ags/gtk4"
import { createEffect } from "ags"
import Cairo from "gi://cairo"

export function Levelbar({ value }: { value: () => number }) {
  const area = new Gtk.DrawingArea()
  area.set_size_request(200, 12)
  area.hexpand = true

  area.set_draw_func((_self: Gtk.DrawingArea, cr: any, w: number, h: number) => {
    const v = Math.min(1, Math.max(0, value()))
    const fillW = Math.max(0, v * (w - 2))

    const borderGradient = new Cairo.LinearGradient(0, 0, w, 0)
    borderGradient.addColorStopRGBA(0, 1, 1, 1, 0)
    borderGradient.addColorStopRGBA(1, 1, 1, 1, 0.8)
    cr.setSource(borderGradient)
    cr.setLineWidth(1)
    cr.rectangle(0.5, 0.5, w - 1, h - 1)
    cr.stroke()

    if (fillW > 1) {
      const gradient = new Cairo.LinearGradient(0, 0, fillW, 0)
      gradient.addColorStopRGBA(0, 1, 0.878, 0.125, 0)
      gradient.addColorStopRGBA(1, 1, 0.878, 0.125, 1)
      cr.setSource(gradient)
      cr.rectangle(1, 1, fillW, h - 2)
      cr.fill()
    }
  })

  createEffect(() => { value(); area.queue_draw() })

  return area
}
