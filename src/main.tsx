import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./fonts.generated";
import { ActivityProvider, DemoProvider, cssVariablesFor } from "@kit";
import { DEMO_CONFIG } from "./demo.generated";
import { theme } from "./theme";
import "./index.css";
import App from "./App";

const styleEl = document.createElement("style");
styleEl.textContent = cssVariablesFor(theme.palette, theme.typefaces);
document.head.appendChild(styleEl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <DemoProvider config={DEMO_CONFIG}>
        <ActivityProvider>
          <App />
        </ActivityProvider>
      </DemoProvider>
    </HashRouter>
  </React.StrictMode>
);
