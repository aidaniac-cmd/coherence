import { world } from "@minecraft/server";
import { AREA_RADIUS, REALITY_COORDINATES, getNextRealityId, getRealityOffset } from "./realityConfig.js";
import { enterReality, exitReality, getSafeArrival, resetRealityEffects } from "./realityAdapter.js";

const playerReality = new Map();

function getRealityCenter(reality) {
  const spawn = world.getDefaultSpawnLocation();
  const offset = getRealityOffset(reality);
  return { x: Math.floor(spawn.x) + offset.x, z: Math.floor(spawn.z) + offset.z };
}

export function getPlayerReality(player) {
  return playerReality.get(player.name) ?? 0;
}

export function initializePlayerReality(player) {
  const spawn = world.getDefaultSpawnLocation();
  let detected = 0;
  for (const [reality, offset] of REALITY_COORDINATES) {
    const localX = player.location.x - (Math.floor(spawn.x) + offset.x);
    const localZ = player.location.z - (Math.floor(spawn.z) + offset.z);
    if (Math.abs(localX) <= AREA_RADIUS + 16 && Math.abs(localZ) <= AREA_RADIUS + 16) {
      detected = reality;
      break;
    }
  }
  playerReality.set(player.name, detected);
  resetRealityEffects(player);
  enterReality(player, detected);
}

export function getNextPlayerReality(player) {
  return getNextRealityId(getPlayerReality(player));
}

export function getLocalLocation(player) {
  const center = getRealityCenter(getPlayerReality(player));
  return {
    x: player.location.x - center.x,
    y: player.location.y,
    z: player.location.z - center.z
  };
}

export function switchReality(player, radius) {
  const nextReality = getNextPlayerReality(player);
  const nextCenter = getRealityCenter(nextReality);
  const localLoc = getLocalLocation(player);
  let newLocalX = localLoc.x;
  let newLocalZ = localLoc.z;

  if (localLoc.x >= radius) newLocalX = -radius + 3;
  if (localLoc.x < -radius) newLocalX = radius - 3;
  if (localLoc.z >= radius) newLocalZ = -radius + 3;
  if (localLoc.z < -radius) newLocalZ = radius - 3;
  const safeArrival = getSafeArrival(nextReality, newLocalX, newLocalZ);

  player.teleport({
    x: nextCenter.x + safeArrival.x,
    y: safeArrival.y ?? player.location.y,
    z: nextCenter.z + safeArrival.z
  });
  exitReality(player, getPlayerReality(player));
  playerReality.set(player.name, nextReality);
  enterReality(player, nextReality);
  player.sendMessage(`\u00A78You entered Reality ${nextReality}`);
}
