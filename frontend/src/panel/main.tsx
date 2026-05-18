import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./panel.css"
import { PanelApp } from "./PanelApp"

createRoot(document.getElementById("panel-root")!).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>
)
