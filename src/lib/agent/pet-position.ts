export type AgentPetPosition = {
  right: number;
  bottom: number;
};

export type AgentPetViewport = {
  width: number;
  height: number;
};

export const AGENT_PET_WIDTH = 82;
export const AGENT_PET_HEIGHT = 75;
export const AGENT_PET_EDGE_GAP = 8;
export const AGENT_PET_PANEL_GAP = 12;
export const DEFAULT_AGENT_PET_POSITION: AgentPetPosition = { right: 24, bottom: 20 };

export function clampAgentPetPosition(
  position: AgentPetPosition,
  viewport: AgentPetViewport,
): AgentPetPosition {
  const maxRight = Math.max(AGENT_PET_EDGE_GAP, viewport.width - AGENT_PET_WIDTH - AGENT_PET_EDGE_GAP);
  const maxBottom = Math.max(AGENT_PET_EDGE_GAP, viewport.height - AGENT_PET_HEIGHT - AGENT_PET_EDGE_GAP);
  return {
    right: clamp(finiteOr(position.right, DEFAULT_AGENT_PET_POSITION.right), AGENT_PET_EDGE_GAP, maxRight),
    bottom: clamp(finiteOr(position.bottom, DEFAULT_AGENT_PET_POSITION.bottom), AGENT_PET_EDGE_GAP, maxBottom),
  };
}

export function clampAgentPetGroupPosition(
  position: AgentPetPosition,
  viewport: AgentPetViewport,
  panel: { width: number; height: number },
): AgentPetPosition {
  const maxRight = Math.max(AGENT_PET_EDGE_GAP, viewport.width - panel.width - AGENT_PET_EDGE_GAP);
  const maxBottom = Math.max(
    AGENT_PET_EDGE_GAP,
    viewport.height - panel.height - AGENT_PET_HEIGHT - AGENT_PET_PANEL_GAP - AGENT_PET_EDGE_GAP,
  );
  return {
    right: clamp(finiteOr(position.right, DEFAULT_AGENT_PET_POSITION.right), AGENT_PET_EDGE_GAP, maxRight),
    bottom: clamp(finiteOr(position.bottom, DEFAULT_AGENT_PET_POSITION.bottom), AGENT_PET_EDGE_GAP, maxBottom),
  };
}

export function parseAgentPetPosition(
  value: string | null,
  viewport: AgentPetViewport,
): AgentPetPosition {
  if (!value) return clampAgentPetPosition(DEFAULT_AGENT_PET_POSITION, viewport);
  try {
    const parsed = JSON.parse(value) as Partial<AgentPetPosition>;
    if (typeof parsed.right !== "number" || typeof parsed.bottom !== "number") {
      return clampAgentPetPosition(DEFAULT_AGENT_PET_POSITION, viewport);
    }
    return clampAgentPetPosition({ right: parsed.right, bottom: parsed.bottom }, viewport);
  } catch {
    return clampAgentPetPosition(DEFAULT_AGENT_PET_POSITION, viewport);
  }
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
