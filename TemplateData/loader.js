(function () {
  "use strict";
  const overlay = document.getElementById("startup-loader");
  const canvas = document.getElementById("unity-canvas");
  const fill = document.getElementById("unity-progress-bar-full");
  const bar = document.getElementById("unity-progress-bar-empty");
  const valueLabel = document.getElementById("startup-progress-value");
  let instance = null;
  let ready = false;
  let failed = false;
  let scheduled = false;
  let handedOff = false;
  let progress = 0;

  // Register before Unity's script so its document/window input listeners cannot
  // consume startup clicks or keys. The canvas retains its real render dimensions.
  const inputEvents = ["pointerdown", "pointerup", "pointermove", "mousedown",
    "mouseup", "mousemove", "click", "dblclick", "touchstart", "touchmove",
    "touchend", "keydown", "keyup", "keypress", "wheel", "contextmenu"];
  function blockInput(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  inputEvents.forEach(type => window.addEventListener(type, blockInput, { capture: true, passive: false }));
  overlay.focus({ preventScroll: true });

  function renderProgress(value) {
    fill.style.width = (value * 100) + "%";
    const percent = Math.floor(value * 100);
    valueLabel.textContent = percent + "%";
    bar.setAttribute("aria-valuenow", String(percent));
    overlay.dataset.progress = String(value);
  }

  function reportProgress(value, stage) {
    if (handedOff || !Number.isFinite(value)) return;
    progress = Math.max(progress, Math.max(0, Math.min(0.99, value)));
    renderProgress(progress);
    // Late download callbacks cannot replace the current runtime/content stage.
    if (stage && stage !== "build") overlay.dataset.stage = stage;
  }

  function removeOverlay(state) {
    handedOff = true;
    overlay.querySelector("img").removeAttribute("src");
    overlay.remove();
    inputEvents.forEach(type => window.removeEventListener(type, blockInput, true));
    canvas.focus({ preventScroll: true });
    document.body.dataset.startupState = state;
  }

  function tryHandoff() {
    if (!instance || !ready || failed || scheduled || handedOff) return;
    scheduled = true;
    requestAnimationFrame(() => {
      if (failed || handedOff) return;
      progress = 1;
      renderProgress(progress);
      // Keep covering one prepared frame, then transfer visibility and input together.
      requestAnimationFrame(() => {
        if (failed || handedOff) return;
        removeOverlay("ready");
        console.info("[Startup] HTML handoff complete.");
      });
    });
  }

  window.escapeMastersLoader = {
    reportProgress: reportProgress,
    instanceCreated: function (value) {
      if (instance) return;
      instance = value;
      window.unityInstance = value;
      console.info("[Startup] Unity instance exists; waiting for game-ready.");
      tryHandoff();
    },
    gameReady: function () {
      if (ready) return;
      ready = true;
      console.info("[Startup] Game-ready signal received.");
      tryHandoff();
    },
    // The game shows a startup error with its own Retry; readiness still comes later.
    reveal: function () {
      if (handedOff || failed) return;
      removeOverlay("game-error");
      console.info("[Startup] HTML loader removed for a game startup error.");
    },
    bootstrapFailed: function (error) {
      failed = true;
      console.error("[Startup] Unity bootstrap failed.", error);
    }
  };
  renderProgress(0);
}());
