import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins conditional class names and resolves conflicting Tailwind utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gives interactive elements the same keyboard focus ring.
 */
export const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Defines the shared size and behavior used by the button variants below.
 */
const BUTTON_BASE =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ' +
  `transition-colors disabled:cursor-default disabled:opacity-50 ${FOCUS_RING}`;

export const BUTTON_PRIMARY =
  `${BUTTON_BASE} bg-primary text-primary-foreground hover:bg-primary/90`;
export const BUTTON_OUTLINE = `${BUTTON_BASE} border hover:bg-accent`;
export const BUTTON_DESTRUCTIVE =
  `${BUTTON_BASE} bg-destructive text-destructive-foreground hover:bg-destructive/90`;

/**
 * Styles borderless icon buttons such as the back button on each screen.
 */
export const BUTTON_ICON =
  'rounded-md p-1 text-muted-foreground transition-colors ' +
  `hover:bg-accent hover:text-foreground ${FOCUS_RING}`;

/**
 * Styles each option in the segmented controls used across the app.
 */
export const TOGGLE_ITEM =
  'px-3 text-muted-foreground hover:bg-transparent hover:text-foreground ' +
  'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm';
