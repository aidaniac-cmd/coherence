import { world, system } from "@minecraft/server";
import {
  AREA_RADIUS,
  AREA_SIZE,
  MAX_REALITY,
  MAX_Y,
  MIN_Y,
  REALITY_COORDINATES,
  getRealityOffset
} from "./realityConfig.js";
import { prepareRealityClone } from "./realityAdapter.js";

const TILE_SIZE = 32;
const TICKS_BETWEEN_OPERATIONS = 4;
const DESTINATION_LOAD_DELAY = 40;
const REALITY_FINISH_DELAY = 80;
const TICKING_AREA_NAME = "coherence_clone_target";

export const realityCloneStates = new Map();
for (const reality of REALITY_COORDINATES.keys()) {
  realityCloneStates.set(reality, reality === 0 ? "ready" : "pending");
}

let hasStartedClone = false;
let allClonesReady = false;

export function isRealityReady(reality) {
  return realityCloneStates.get(reality) === "ready";
}

export function areRealityClonesReady() {
  return allClonesReady;
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
    const result = overworld.runCommand(
      `tickingarea add ${fromX} ${MIN_Y} ${fromZ} ${toX} ${MAX_Y} ${toZ} ${TICKING_AREA_NAME} true`
    );
    return result.successCount > 0;
  } catch {
    // Structure placement can queue unloaded chunks as a fallback.
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

function deleteStructures(structures) {
  for (const structure of structures) {
    try {
      world.structureManager.delete(structure);
    } catch {
      // Continue cleaning up the remaining structures.
    }
  }
}

function shouldReportProgress(reality) {
  return reality === 1 || reality === MAX_REALITY || reality % 10 === 0;
}

export function setupRealityClones() {
  if (hasStartedClone) return;
  hasStartedClone = true;
  allClonesReady = false;

  system.runTimeout(() => {
    const overworld = world.getDimension("overworld");
    const origin = getOrigin();
    const jobs = createTileJobs(origin);
    const structures = [];
    let captureIndex = 0;
    let allDestinationsPreloaded = true;

    world.sendMessage("\u00A77Capturing Reality 0...");

    const failCloneQueue = (error) => {
      removeTickingArea(overworld);
      deleteStructures(structures);
      hasStartedClone = false;
      world.sendMessage(`\u00A7cReality queue failed: ${error}`);
    };

    const finishQueue = () => {
      removeTickingArea(overworld);
      // Queued placements may need the templates until their chunks load.
      if (allDestinationsPreloaded) deleteStructures(structures);
      allClonesReady = true;
      world.sendMessage(`\u00A7aAll ${MAX_REALITY} reality clones are ready.`);
    };

    const cloneReality = (reality) => {
      if (reality > MAX_REALITY) {
        finishQueue();
        return;
      }

      const offset = getRealityOffset(reality);
      const destinationPreloaded = loadDestination(overworld, origin, offset);
      allDestinationsPreloaded = allDestinationsPreloaded && destinationPreloaded;
      realityCloneStates.set(reality, "cloning");
      let tileIndex = 0;

      const placeNextTile = () => {
        if (tileIndex >= structures.length) {
          system.runTimeout(() => {
            realityCloneStates.set(reality, "adapting");
            prepareRealityClone(reality, origin, overworld, () => {
              removeTickingArea(overworld);
              realityCloneStates.set(reality, "ready");

              if (shouldReportProgress(reality)) {
                world.sendMessage(`\u00A7aReality ${reality}/${MAX_REALITY} ready.`);
              }

              // No next reality starts until cloning and adaptation are complete.
              system.runTimeout(() => cloneReality(reality + 1), TICKS_BETWEEN_OPERATIONS);
            });
          }, REALITY_FINISH_DELAY);
          return;
        }

        try {
          const job = jobs[tileIndex];
          world.structureManager.place(
            structures[tileIndex],
            overworld,
            { x: job.from.x + offset.x, y: MIN_Y, z: job.from.z + offset.z },
            { includeBlocks: true, includeEntities: false }
          );
          tileIndex++;
          system.runTimeout(placeNextTile, TICKS_BETWEEN_OPERATIONS);
        } catch (error) {
          realityCloneStates.set(reality, "failed");
          failCloneQueue(error);
        }
      };

      system.runTimeout(placeNextTile, DESTINATION_LOAD_DELAY);
    };

    const captureNextTile = () => {
      if (captureIndex >= jobs.length) {
        world.sendMessage(`\u00A77Reality 0 captured in ${structures.length} tiles.`);
        cloneReality(1);
        return;
      }

      const job = jobs[captureIndex];
      try {
        const structure = world.structureManager.createFromWorld(
          job.id,
          overworld,
          job.from,
          job.to,
          { includeBlocks: true, includeEntities: false }
        );
        structures.push(structure);
        captureIndex++;
        system.runTimeout(captureNextTile, TICKS_BETWEEN_OPERATIONS);
      } catch (error) {
        failCloneQueue(error);
      }
    };

    system.runTimeout(captureNextTile, DESTINATION_LOAD_DELAY);
  }, 20);
}
