import { useEffect } from "react";

const layoutKeys = {
  "candidate-dock": ["coderoom:candidate-dock-width", "--candidate-dock-width"],
  "interviewer-left": ["coderoom:interviewer-left-width", "--interviewer-left-width"],
  "interviewer-top": ["coderoom:interviewer-top-height", "--interviewer-top-height"],
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function useResizableLayouts() {
  useEffect(() => {
    for (const [, [key, cssVar]] of Object.entries(layoutKeys)) {
      const value = localStorage.getItem(key);
      if (value) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    }

    const disposers = [];

    for (const handle of document.querySelectorAll(".resize-handle")) {
      const onPointerDown = (event) => {
        const mode = handle.dataset.resize;
        const grid = handle.closest(".candidate-grid, .interviewer-grid");
        if (!grid) {
          return;
        }

        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        handle.classList.add("dragging");

        const onMove = (moveEvent) => {
          const rect = grid.getBoundingClientRect();

          if (mode === "candidate-dock") {
            const width = clamp(rect.right - moveEvent.clientX, 280, Math.max(280, rect.width * 0.6));
            const value = `${Math.round(width)}px`;
            document.documentElement.style.setProperty("--candidate-dock-width", value);
            localStorage.setItem("coderoom:candidate-dock-width", value);
          }

          if (mode === "interviewer-left") {
            const width = clamp(moveEvent.clientX - rect.left, 280, Math.max(280, rect.width * 0.48));
            const value = `${Math.round(width)}px`;
            document.documentElement.style.setProperty("--interviewer-left-width", value);
            localStorage.setItem("coderoom:interviewer-left-width", value);
          }

          if (mode === "interviewer-top") {
            const height = clamp(moveEvent.clientY - rect.top, 160, Math.max(160, rect.height - 260));
            const value = `${Math.round(height)}px`;
            document.documentElement.style.setProperty("--interviewer-top-height", value);
            localStorage.setItem("coderoom:interviewer-top-height", value);
          }
        };

        const onUp = () => {
          handle.classList.remove("dragging");
          handle.releasePointerCapture?.(event.pointerId);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      };

      handle.addEventListener("pointerdown", onPointerDown);
      disposers.push(() => handle.removeEventListener("pointerdown", onPointerDown));
    }

    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, []);
}
