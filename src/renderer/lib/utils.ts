import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The app's focus ring, on every element that takes keyboard focus. */
export const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Shared button shape. Use one of the variants below, not this on its own. */
const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ' +
  `transition-colors disabled:cursor-default disabled:opacity-50 ${FOCUS_RING}`;

export const BUTTON_PRIMARY = `${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
export const BUTTON_OUTLINE = `${BUTTON} border hover:bg-accent`;
export const BUTTON_DESTRUCTIVE =
  `${BUTTON} bg-destructive text-destructive-foreground hover:bg-destructive/90`;
