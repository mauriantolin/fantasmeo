"use client";

import { Slider } from "@/components/ui/slider";
import { getGhostBand, GHOST_BAND_LABELS } from "@/lib/ai/ghost-level";
import type { GhostBand } from "@/lib/ai/ghost-level";

const BAND_COLORS: Record<GhostBand, string> = {
  honesto: "text-green-400",
  maquillado: "text-yellow-400",
  fantasma: "text-orange-400",
  fantasma_total: "text-red-400",
};

const BAND_EMOJI_SIZE: Record<GhostBand, string> = {
  honesto: "text-base",
  maquillado: "text-lg",
  fantasma: "text-xl",
  fantasma_total: "text-2xl",
};

const BAND_DESCRIPTIONS: Record<GhostBand, string> = {
  honesto: "Solo reordena y enfatiza lo que ya está en tu CV.",
  maquillado: "Estira la terminología: lo que tocaste alguna vez aparece como experiencia.",
  fantasma: "Infla seniority y suma responsabilidades plausibles.",
  fantasma_total: "Estiramiento máximo defendible. Nunca inventa títulos, empresas ni fechas.",
};

interface GhostSliderProps {
  value: number;
  onChange: (v: number) => void;
}

export function GhostSlider({ value, onChange }: GhostSliderProps) {
  const band = getGhostBand(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={BAND_EMOJI_SIZE[band]}>👻</span>
          <span className={`text-sm font-medium ${BAND_COLORS[band]}`}>
            {GHOST_BAND_LABELS[band]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{value}</span>
      </div>

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
      />

      <p className="text-xs text-muted-foreground">{BAND_DESCRIPTIONS[band]}</p>
    </div>
  );
}
