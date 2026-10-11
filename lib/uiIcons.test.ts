import { describe, expect, it } from "vitest";
import { UI_ICON, iconEdge } from "@/lib/uiIcons";

describe("iconEdge", () => {
  it("widens every line by the same amount and strokes filled shapes", () => {
    const edge = iconEdge(UI_ICON.walker);
    expect(edge).toContain('stroke-width="5.2"'); // body 2.8 + 2 x 1.2
    expect(edge).toContain('stroke-width="4.1"'); // stick 1.7 + 2 x 1.2
    expect(edge).toMatch(/<circle [^>]*stroke-width="2.4"/); // head
    expect(edge).not.toMatch(/stroke-linecap="round"[^>]*stroke-linecap/); // no doubled attributes
  });
});
