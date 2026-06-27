import { world } from "@minecraft/server";
import { isInFog, applyFogEffects } from "./fog.js";
import { switchReality, getLocalLocation } from "./teleport.js";
import { areRealityClonesReady } from "./cloneManager.js";
import { AREA_RADIUS } from "./realityConfig.js";

export function updatePlayers() {
  for (const player of world.getPlayers()) {
    const localLoc = getLocalLocation(player);
    applyFogEffects(player, localLoc, AREA_RADIUS);

    if (areRealityClonesReady() && isInFog(localLoc, AREA_RADIUS)) {
      switchReality(player, AREA_RADIUS);
    }
  }
}
