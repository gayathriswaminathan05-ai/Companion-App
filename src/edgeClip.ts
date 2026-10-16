import { createContext } from "react";

/**
 * How many px of the companion window sit off-screen on each side (the plant
 * can be dragged into a corner). Pop-ups such as tooltips read this so they
 * stay inside the visible part of the screen instead of the whole window.
 */
export const EdgeClipContext = createContext({ left: 0, right: 0, top: 0, bottom: 0 });
