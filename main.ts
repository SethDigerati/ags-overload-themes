import app from "ags/gtk4/app"
import style from "./style.css"
import { RightCol, LeftCol } from "./src/ColumnWindows"

app.start({
  css: style,
  main() {
    RightCol()
    LeftCol()
  },
})
