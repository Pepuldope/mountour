import type { Map as MlMap } from "maplibre-gl";

/**
 * Phones, map in the page (Peter, 2026-10-19, experimental): the map only takes taps, so a finger
 * dragged over it scrolls the page past it. Moving and zooming come back in full screen.
 */
export function setTapOnly(map: MlMap, tapOnly: boolean) {
  const handlers = [map.dragPan, map.touchZoomRotate, map.doubleClickZoom, map.touchPitch];
  for (const h of handlers) {
    if (tapOnly) h.disable();
    else h.enable();
  }
  if (!tapOnly) map.touchZoomRotate.disableRotation();
  // With dragging off MapLibre leaves the canvas to the browser: a vertical swipe scrolls the page.
  map.getCanvasContainer().style.touchAction = tapOnly ? "pan-x pan-y" : "";
}
