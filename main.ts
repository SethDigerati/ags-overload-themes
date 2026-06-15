import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import style from "./style.css"
import System from "./src/System"
import Cpu from "./src/Cpu"
import Gpu from "./src/Gpu"
import Memory from "./src/Memory"
import Network from "./src/Network"
import Weather from "./src/Weather"
import LastFm from "./src/LastFm"
import Market from "./src/Market"
import News from "./src/News"
import Quote from "./src/Quote"

app.start({
  css: style,
  main() {
    System()
    Cpu()
    Gpu()
    Memory()
    Network()
    Weather()
    LastFm()
    Market()
    News()
    Quote()
  },
})
