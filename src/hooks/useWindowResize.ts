import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

const DEBOUNCE_MS = 500;

/**
 * Debounced window resize listener that calls onResize with the new size.
 * @param onResize - callback receiving { width, height }
 * @param enabled - whether to listen (default: true)
 */
export function useWindowResize(
  onResize: (size: { width: number; height: number }) => Promise<void>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const win = getCurrentWindow();

    const unlisten = win.onResized(async (event) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        await onResize({
          width: event.payload.width,
          height: event.payload.height,
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timeoutId);
      unlisten.then((fn) => fn());
    };
  }, [onResize, enabled]);
}
