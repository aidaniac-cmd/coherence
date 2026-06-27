import { world } from "@minecraft/server";
import { getNextRealityId, getRealityOffset } from "./realityConfig.js";

const playerReality = new Map();

function getRealityCenter(reality) {
  const spawn = world.getDefaultSpawnLocation();
  const offset = getRealityOffset(reality);
  return { x: Math.floor(spawn.x) + offset.x, z: Math.floor(spawn.z) + offset.z };
}

export function getPlayerReality(player) {
  return playerReality.get(player.name) ?? 0;
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

  player.teleport({
    x: nextCenter.x + newLocalX,
    y: player.location.y,
    z: nextCenter.z + newLocalZ
  });
  playerReality.set(player.name, nextReality);
  player.sendMessage(`\u00A78You entered Reality ${nextReality}`);
}
