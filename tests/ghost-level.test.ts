import { describe, it, expect } from "vitest";
import { getGhostBand, getGhostInstructions, GHOST_BAND_LABELS } from "@/lib/ai/ghost-level";

describe("getGhostBand", () => {
  it("maps 0 to honesto", () => expect(getGhostBand(0)).toBe("honesto"));
  it("maps 25 to honesto", () => expect(getGhostBand(25)).toBe("honesto"));
  it("maps 26 to maquillado", () => expect(getGhostBand(26)).toBe("maquillado"));
  it("maps 50 to maquillado", () => expect(getGhostBand(50)).toBe("maquillado"));
  it("maps 51 to fantasma", () => expect(getGhostBand(51)).toBe("fantasma"));
  it("maps 75 to fantasma", () => expect(getGhostBand(75)).toBe("fantasma"));
  it("maps 76 to fantasma_total", () => expect(getGhostBand(76)).toBe("fantasma_total"));
  it("maps 100 to fantasma_total", () => expect(getGhostBand(100)).toBe("fantasma_total"));
  it("throws on out-of-range values", () => {
    expect(() => getGhostBand(-1)).toThrow();
    expect(() => getGhostBand(101)).toThrow();
  });
});

describe("getGhostInstructions", () => {
  it("every band's instructions forbid fabricating credentials", () => {
    for (const level of [0, 30, 60, 90]) {
      const instructions = getGhostInstructions(level);
      expect(instructions).toMatch(/NEVER fabricate/i);
    }
  });

  it("honesto instructions do not allow stretching", () => {
    expect(getGhostInstructions(10)).not.toMatch(/stretch|inflate/i);
  });

  it("fantasma_total instructions allow maximum stretch", () => {
    expect(getGhostInstructions(100)).toMatch(/maximum/i);
  });
});

describe("GHOST_BAND_LABELS", () => {
  it("has Spanish labels for all four bands", () => {
    expect(Object.keys(GHOST_BAND_LABELS)).toEqual([
      "honesto", "maquillado", "fantasma", "fantasma_total",
    ]);
  });
});
