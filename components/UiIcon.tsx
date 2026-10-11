import { UI_ICON } from "@/lib/uiIcons";
import type { UiIconName } from "@/lib/uiIcons";

/** An interface pictogram (car, bus, walker...) in the current text colour. */
export function UiIcon({ name, size = 18, className }: { name: UiIconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={`inline-block shrink-0 ${className ?? ""}`}
      // Constant markup from lib/uiIcons.ts, no user data.
      dangerouslySetInnerHTML={{ __html: UI_ICON[name] }}
    />
  );
}
