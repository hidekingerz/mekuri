import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Viewer from "./ViewerApp";
import "./styles/viewer.css";

// biome-ignore lint/style/noNonNullAssertion: root element always exists in viewer.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Viewer />
  </StrictMode>,
);
