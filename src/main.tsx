import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Start in macOS light / dark appearance; App's usePanelTheme takes over
// (and can match the app behind the companion when that setting is on).
document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
