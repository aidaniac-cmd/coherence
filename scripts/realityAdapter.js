import { BlockPermutation, system, world } from "@minecraft/server";
import { AREA_RADIUS, AREA_SIZE, MAX_Y, MIN_Y, getRealityOffset } from "./realityConfig.js";
import { getRealityRecipe } from "./realityCatalog.js";

const COMMANDS_PER_TICK = 8;
const BLOCKS_PER_TICK = 4096;
const FOG_STACK_ID = "coherence_reality_effect";
const OVERWORLD_MIN_Y = -64;
const OVERWORLD_MAX_Y = 319;
let initialized = false;

function namespace(blockId) {
  return blockId.includes(":") ? blockId : `minecraft:${blockId}`;
}

function getBounds(reality, origin) {
  const offset = getRealityOffset(reality);
  const centerX = origin.x + offset.x;
  const centerZ = origin.z + offset.z;
  return {
    centerX,
    centerZ,
    minX: centerX - AREA_RADIUS,
    maxX: centerX + AREA_RADIUS - 1,
    minZ: centerZ - AREA_RADIUS,
    maxZ: centerZ + AREA_RADIUS - 1
  };
}

function replacementCommands(bounds, replacements) {
  const commands = [];
  for (const [from, to] of replacements) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 16) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 16) {
        commands.push(
          `fill ${x} ${MIN_Y} ${z} ${Math.min(x + 15, bounds.maxX)} ${MAX_Y} ${Math.min(z + 15, bounds.maxZ)} ${namespace(to)} replace ${namespace(from)}`
        );
      }
    }
  }
  return commands;
}

function runCommandQueue(dimension, commands, done) {
  let index = 0;
  const runBatch = () => {
    const end = Math.min(index + COMMANDS_PER_TICK, commands.length);
    while (index < end) {
      try {
        dimension.runCommand(commands[index]);
      } catch {
        // A version-specific block id should not stop the other mutations.
      }
      index++;
    }
    if (index < commands.length) system.run(runBatch);
    else done();
  };
  runBatch();
}

function runScan(dimension, bounds, scan, done) {
  const width = AREA_SIZE;
  const depth = AREA_SIZE;
  const height = MAX_Y - MIN_Y + 1;
  const total = width * depth * height;
  const chosen = [];
  const output = scan.block ? BlockPermutation.resolve(namespace(scan.block)) : BlockPermutation.resolve("minecraft:air");
  let index = 0;
  let candidates = 0;

  const scanBatch = () => {
    const end = Math.min(index + BLOCKS_PER_TICK, total);
    while (index < end) {
      const yIndex = Math.floor(index / (width * depth));
      const flat = index % (width * depth);
      const x = bounds.minX + (flat % width);
      const z = bounds.minZ + Math.floor(flat / width);
      const y = MIN_Y + yIndex;
      index++;
      try {
        const block = dimension.getBlock({ x, y, z });
        if (!block || block.isAir) continue;
        if (scan.type === "solidify") {
          if (block.typeId !== namespace(scan.block)) block.setPermutation(output);
          continue;
        }
        candidates++;
        const location = { x, y, z };
        if (chosen.length < scan.count) chosen.push(location);
        else {
          const slot = Math.floor(Math.random() * candidates);
          if (slot < scan.count) chosen[slot] = location;
        }
      } catch {
        // Destination remains loaded by cloneManager; tolerate edge unloads.
      }
    }
    if (index < total) {
      system.run(scanBatch);
      return;
    }
    if (scan.type === "random_air") {
      for (const location of chosen) {
        try { dimension.getBlock(location)?.setPermutation(output); } catch { }
      }
    }
    done();
  };
  scanBatch();
}

export function prepareRealityClone(reality, origin, dimension, done) {
  const recipe = getRealityRecipe(reality);
  const bounds = getBounds(reality, origin);
  const commands = replacementCommands(bounds, recipe.replacements ?? []);
  if (recipe.voidChunk) {
    const chunk = recipe.voidChunk;
    for (let y = OVERWORLD_MIN_Y; y <= OVERWORLD_MAX_Y; y += 64) {
      commands.push(`fill ${bounds.centerX + chunk.minX} ${y} ${bounds.centerZ + chunk.minZ} ${bounds.centerX + chunk.maxX} ${Math.min(y + 63, OVERWORLD_MAX_Y)} ${bounds.centerZ + chunk.maxZ} minecraft:air`);
    }
  }
  runCommandQueue(dimension, commands, () => {
    if (recipe.scan) runScan(dimension, bounds, recipe.scan, done);
    else done();
  });
}

function safeCommand(player, command) {
  try { player.runCommand(command); } catch { }
}

export function resetRealityEffects(player) {
  safeCommand(player, `fog @s remove ${FOG_STACK_ID}`);
  safeCommand(player, "camera @s clear");
  safeCommand(player, "camera @s fov_clear 0.1 linear");
  safeCommand(player, "effect @s clear nausea");
}

export function exitReality(player, reality) {
  const recipe = getRealityRecipe(reality);
  if (recipe.fog) safeCommand(player, `fog @s remove ${FOG_STACK_ID}`);
  if (recipe.invertedView) {
    safeCommand(player, "camera @s clear");
    safeCommand(player, "camera @s fov_clear 0.1 linear");
    safeCommand(player, "effect @s clear nausea");
  }
}

export function enterReality(player, reality) {
  const recipe = getRealityRecipe(reality);
  if (recipe.fog) safeCommand(player, `fog @s push ${recipe.fog} ${FOG_STACK_ID}`);
  if (recipe.invertedView) {
    const yaw = Math.round(player.getRotation().y);
    // Bedrock exposes pitch/yaw but no roll. A 180-degree camera pitch is the
    // closest client-stable approximation, with narrow FOV/nausea fallback.
    safeCommand(player, `camera @s set minecraft:first_person rot 180 ${yaw}`);
    safeCommand(player, "camera @s fov_set 30 0.2 linear");
    safeCommand(player, "effect @s nausea 2 0 true");
  }
}

export function tickRealityEffects(player, reality) {
  const recipe = getRealityRecipe(reality);
  if (!recipe.invertedView) return;
  const yaw = Math.round(player.getRotation().y);
  safeCommand(player, `camera @s set minecraft:first_person rot 180 ${yaw}`);
  safeCommand(player, "effect @s nausea 2 0 true");
}

export function getSafeArrival(reality, localX, localZ) {
  const chunk = getRealityRecipe(reality).voidChunk;
  if (!chunk) return { x: localX, z: localZ };
  const inX = localX >= chunk.minX && localX <= chunk.maxX;
  const inZ = localZ >= chunk.minZ && localZ <= chunk.maxZ;
  if (!inX || !inZ) return { x: localX, z: localZ };
  return { x: chunk.maxX + 5, z: localZ };
}

function isInsideReality(location, reality) {
  const spawn = world.getDefaultSpawnLocation();
  const bounds = getBounds(reality, { x: Math.floor(spawn.x), z: Math.floor(spawn.z) });
  return location.x >= bounds.minX && location.x <= bounds.maxX &&
    location.z >= bounds.minZ && location.z <= bounds.maxZ;
}

export function initializeRealityAdapter() {
  if (initialized) return;
  initialized = true;
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      if (!isInsideReality(entity.location, 7)) return;
      const family = entity.getComponent("minecraft:type_family");
      if (family?.hasTypeFamily("mob")) entity.remove();
    } catch {
      // The entity can become invalid between the spawn event and this callback.
    }
  });
}
