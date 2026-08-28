import React from "react";
import ReactDOM from "react-dom/client";

function App(): React.ReactElement {
  return (
    <div>
      <h1>KB Desktop</h1>
      <p>Loading…</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
