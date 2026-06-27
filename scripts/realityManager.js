import { world } from "@minecraft/server";
import { isInFog, applyFogEffects } from "./fog.js";
import { getLocalLocation, getNextPlayerReality, switchReality } from "./teleport.js";
import { isRealityReady } from "./cloneManager.js";
import { AREA_RADIUS } from "./realityConfig.js";

export function updatePlayers() {
  for (const player of world.getPlayers()) {
    const localLoc = getLocalLocation(player);
    applyFogEffects(player, localLoc, AREA_RADIUS);

    const nextReality = getNextPlayerReality(player);
    if (isRealityReady(nextReality) && isInFog(localLoc, AREA_RADIUS)) {
      switchReality(player, AREA_RADIUS);
    }
  }
}
