import { world } from "@minecraft/server";
import { isInFog, applyFogEffects } from "./fog.js";
import { switchReality } from "./teleport.js";

const PLAY_AREA_RADIUS = 64;

export function updatePlayers() {
  for (const player of world.getPlayers()) {
    const loc = player.location;

    applyFogEffects(player, loc, PLAY_AREA_RADIUS);

    if (isInFog(loc, PLAY_AREA_RADIUS)) {
      switchReality(player, PLAY_AREA_RADIUS);
    }
  }
}