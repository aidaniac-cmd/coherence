import { world, system } from "@minecraft/server";
import { AREA_RADIUS, AREA_SIZE, MAX_Y, MIN_Y, REALITY_OFFSETS } from "./realityConfig.js";

const TILE_SIZE = 32;
const TICKS_BETWEEN_TILES = 4;
const SOURCE_LOAD_DELAY = 40;
const FINISH_DELAY = 80;
const TICKING_AREA_NAME = "coherence_clone_target";

let hasStartedClone = false;
let clonesReady = false;

export function areRealityClonesReady() {
  return clonesReady;
}

function getOrigin() {
  const spawn = world.getDefaultSpawnLocation();
  return { x: Math.floor(spawn.x), z: Math.floor(spawn.z) };
}

function removeTickingArea(overworld) {
  try {
    overworld.runCommand(`tickingarea remove ${TICKING_AREA_NAME}`);
  } catch {
    // Fine when the area does not exist or commands are unavailable.
  }
}

function loadDestination(overworld, origin, offset) {
  removeTickingArea(overworld);
  const fromX = origin.x + offset.x - AREA_RADIUS;
  const fromZ = origin.z + offset.z - AREA_RADIUS;
  const toX = fromX + AREA_SIZE - 1;
  const toZ = fromZ + AREA_SIZE - 1;

  try {
    overworld.runCommand(
      `tickingarea add ${fromX} ${MIN_Y} ${fromZ} ${toX} ${MAX_Y} ${toZ} ${TICKING_AREA_NAME} true`
    );
    return true;
  } catch {
    // Structure placement queues unloaded chunks, so this has a safe fallback.
    return false;
  }
}

function createTileJobs(origin) {
  const jobs = [];

  for (let localX = -AREA_RADIUS; localX < AREA_RADIUS; localX += TILE_SIZE) {
    for (let localZ = -AREA_RADIUS; localZ < AREA_RADIUS; localZ += TILE_SIZE) {
      jobs.push({
        id: `coherence:reality_tile_${jobs.length}`,
        from: { x: origin.x + localX, y: MIN_Y, z: origin.z + localZ },
        to: {
          x: origin.x + localX + TILE_SIZE - 1,
          y: MAX_Y,
          z: origin.z + localZ + TILE_SIZE - 1
        }
      });
    }
  }

  return jobs;
}

export function setupRealityClones() {
  if (hasStartedClone) return;
  hasStartedClone = true;
  clonesReady = false;

  system.runTimeout(() => {
    const overworld = world.getDimension("overworld");
    const origin = getOrigin();
    const destinations = REALITY_OFFSETS.slice(1);
    const jobs = createTileJobs(origin);
    const savedStructures = [];
    let jobIndex = 0;

    world.sendMessage("§7Preparing reality copy...");
    const destinationPreloaded = destinations.every((offset) =>
      loadDestination(overworld, origin, offset)
    );

    const copyNextTile = () => {
      if (jobIndex >= jobs.length) {
        system.runTimeout(() => {
          removeTickingArea(overworld);
          if (destinationPreloaded) {
            for (const structure of savedStructures) {
              try {
                world.structureManager.delete(structure);
              } catch {
                // Cleanup failure should not prevent teleporting.
              }
            }
          }
          clonesReady = true;
          world.sendMessage("§aReality copy ready.");
        }, FINISH_DELAY);
        return;
      }

      const job = jobs[jobIndex];
      try {
        const structure = world.structureManager.createFromWorld(
          job.id,
          overworld,
          job.from,
          job.to,
          { includeBlocks: true, includeEntities: false }
        );
        savedStructures.push(structure);

        for (const offset of destinations) {
          world.structureManager.place(
            structure,
            overworld,
            { x: job.from.x + offset.x, y: MIN_Y, z: job.from.z + offset.z },
            { includeBlocks: true, includeEntities: false }
          );
        }

        jobIndex++;
        system.runTimeout(copyNextTile, TICKS_BETWEEN_TILES);
      } catch (error) {
        removeTickingArea(overworld);
        for (const structure of savedStructures) {
          try {
            world.structureManager.delete(structure);
          } catch {
            // Continue cleanup after a partially completed copy.
          }
        }
        hasStartedClone = false;
        world.sendMessage(`§cReality copy failed: ${error}`);
      }
    };

    system.runTimeout(copyNextTile, SOURCE_LOAD_DELAY);
  }, 20);
}
