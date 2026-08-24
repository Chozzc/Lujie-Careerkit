import { describe, expect, it } from "vitest";

import {
  DEFAULT_AGENT_PET_POSITION,
  clampAgentPetGroupPosition,
  clampAgentPetPosition,
  parseAgentPetPosition,
} from "./pet-position";

const viewport = { width: 400, height: 300 };

describe("agent pet position", () => {
  it("keeps the pet inside the viewport", () => {
    expect(clampAgentPetPosition({ right: -20, bottom: 999 }, viewport)).toEqual({
      right: 8,
      bottom: 217,
    });
    expect(clampAgentPetPosition({ right: 999, bottom: 20 }, viewport)).toEqual({
      right: 310,
      bottom: 20,
    });
  });

  it("restores valid saved coordinates and rejects malformed storage", () => {
    expect(parseAgentPetPosition('{"right":120,"bottom":48}', viewport)).toEqual({
      right: 120,
      bottom: 48,
    });
    expect(parseAgentPetPosition('{"right":"far"}', viewport)).toEqual(DEFAULT_AGENT_PET_POSITION);
    expect(parseAgentPetPosition("not-json", viewport)).toEqual(DEFAULT_AGENT_PET_POSITION);
  });

  it("keeps the open panel and pet together inside the viewport", () => {
    expect(clampAgentPetGroupPosition(
      { right: 120, bottom: 200 },
      { width: 400, height: 700 },
      { width: 360, height: 500 },
    )).toEqual({ right: 32, bottom: 105 });
  });
});
