import { BlockPermutation, ItemStack, system, world } from "@minecraft/server";
import { AREA_RADIUS, AREA_SIZE, MAX_REALITY, MAX_Y, MIN_Y, getRealityOffset } from "./realityConfig.js";
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

function resolvePermutation(blockId, fallback = "minecraft:stone") {
  try { return BlockPermutation.resolve(namespace(blockId)); }
  catch { return BlockPermutation.resolve(fallback); }
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

function coordinateHash(x, y, z) {
  let value = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
  value ^= value >>> 13;
  return Math.abs(value);
}

function runGoldLayerScan(dimension, bounds, done) {
  const gold = BlockPermutation.resolve("minecraft:gold_block");
  const ore = BlockPermutation.resolve("minecraft:gold_ore");
  let column = 0;
  const runBatch = () => {
    const end = Math.min(column + 32, AREA_SIZE * AREA_SIZE);
    while (column < end) {
      const x = bounds.minX + (column % AREA_SIZE);
      const z = bounds.minZ + Math.floor(column / AREA_SIZE);
      let foundSurface = false;
      for (let y = MAX_Y; y >= MIN_Y; y--) {
        try {
          const block = dimension.getBlock({ x, y, z });
          if (!block || block.isAir) continue;
          block.setPermutation(foundSurface ? ore : gold);
          foundSurface = true;
        } catch { }
      }
      column++;
    }
    if (column < AREA_SIZE * AREA_SIZE) system.run(runBatch);
    else done();
  };
  runBatch();
}

function runScan(dimension, bounds, scan, done) {
  if (scan.type === "gold_layers") {
    runGoldLayerScan(dimension, bounds, done);
    return;
  }
  const width = AREA_SIZE;
  const depth = AREA_SIZE;
  const height = MAX_Y - MIN_Y + 1;
  const total = width * depth * height;
  const chosen = [];
  const output = scan.block ? resolvePermutation(scan.block) : resolvePermutation("air", "minecraft:air");
  const palette = (scan.palette ?? []).map((block) => resolvePermutation(block));
  const stone = resolvePermutation("stone");
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
        if (!block) continue;
        if (scan.type === "chunk_spheres") {
          const dx = ((x - bounds.minX) % 16) - 7.5;
          const dz = ((z - bounds.minZ) % 16) - 7.5;
          const dy = y - 86;
          if (dx * dx + dy * dy + dz * dz <= 121) {
            if (block.isAir) block.setPermutation(stone);
          } else if (!block.isAir) block.setPermutation(output);
          continue;
        }
        if (scan.type === "chunk_pillars") {
          const lx = (x - bounds.minX) % 16;
          const lz = (z - bounds.minZ) % 16;
          if (lx >= 5 && lx <= 10 && lz >= 5 && lz <= 10) block.setPermutation(stone);
          else if (!block.isAir) block.setPermutation(output);
          continue;
        }
        if (block.isAir) continue;
        if (scan.type === "clear") {
          block.setPermutation(output);
          continue;
        }
        if (scan.type === "palette" || scan.type === "stripes" || scan.type === "chunk_checker") {
          let slot = coordinateHash(x, y, z) % palette.length;
          if (scan.type === "stripes") slot = Math.floor((x - bounds.minX) / 4) % palette.length;
          if (scan.type === "chunk_checker") slot = (Math.floor((x - bounds.minX) / 16) + Math.floor((z - bounds.minZ) / 16)) % palette.length;
          block.setPermutation(palette[slot]);
          continue;
        }
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

function surfaceY(dimension, x, z) {
  for (let y = MAX_Y; y >= MIN_Y; y--) {
    try {
      if (!dimension.getBlock({ x, y, z })?.isAir) return y;
    } catch { }
  }
  return MIN_Y;
}

function addSphere(commands, x, y, z, radius, block) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const span = Math.floor(Math.sqrt(radius * radius - dy * dy - dz * dz));
      if (Number.isNaN(span)) continue;
      commands.push(`fill ${x - span} ${y + dy} ${z + dz} ${x + span} ${y + dy} ${z + dz} ${namespace(block)}`);
    }
  }
}

function runFeature(dimension, bounds, feature, done) {
  if (!feature) {
    done();
    return;
  }
  const commands = [];
  const centerX = bounds.centerX;
  const centerZ = bounds.centerZ;

  if (feature === "houses") {
    const homes = [[-42, -36], [-14, -36], [14, -36], [42, -36], [-42, 24], [-14, 24], [14, 24], [42, 24]];
    for (const [lx, lz] of homes) {
      const x = centerX + lx;
      const z = centerZ + lz;
      const y = surfaceY(dimension, x, z) + 1;
      commands.push(`fill ${x - 5} ${y} ${z - 4} ${x + 5} ${y + 5} ${z + 4} minecraft:oak_planks hollow`);
      commands.push(`fill ${x - 6} ${y + 6} ${z - 5} ${x + 6} ${y + 6} ${z + 5} minecraft:brick_block`);
      commands.push(`fill ${x - 1} ${y} ${z - 4} ${x} ${y + 2} ${z - 4} minecraft:air`);
      commands.push(`setblock ${x - 4} ${y + 2} ${z - 4} minecraft:glass`);
      commands.push(`setblock ${x + 4} ${y + 2} ${z - 4} minecraft:glass`);
      commands.push(`fill ${Math.min(x, centerX)} ${y} ${z - 1} ${Math.max(x, centerX)} ${y} ${z + 1} minecraft:stonebrick`);
      commands.push(`fill ${centerX - 1} ${y} ${Math.min(z, centerZ)} ${centerX + 1} ${y} ${Math.max(z, centerZ)} minecraft:stonebrick`);
    }
    commands.push(`fill ${centerX - 60} ${surfaceY(dimension, centerX, centerZ) + 1} ${centerZ - 7} ${centerX + 60} ${surfaceY(dimension, centerX, centerZ) + 1} ${centerZ - 3} minecraft:stonebrick`);
    commands.push(`fill ${centerX - 3} ${surfaceY(dimension, centerX, centerZ) + 1} ${centerZ - 55} ${centerX + 3} ${surfaceY(dimension, centerX, centerZ) + 1} ${centerZ + 55} minecraft:stonebrick`);
  }

  if (feature === "loot_chests") {
    for (let i = 0; i < 50; i++) {
      const lx = -55 + (i % 10) * 12 + (coordinateHash(i, 45, 1) % 3);
      const lz = -50 + Math.floor(i / 10) * 24 + (coordinateHash(i, 91, 2) % 3);
      const x = centerX + lx;
      const z = centerZ + lz;
      const y = surfaceY(dimension, x, z) + 1;
      const tables = ["chests/simple_dungeon", "chests/abandoned_mineshaft", "chests/desert_pyramid", "chests/end_city_treasure", "chests/woodland_mansion"];
      commands.push(`setblock ${x} ${y} ${z} minecraft:chest`);
      commands.push(`loot insert ${x} ${y} ${z} loot ${tables[i % tables.length]}`);
    }
  }

  if (feature === "pyramids") {
    for (let x = -48; x <= 48; x += 32) for (let z = -48; z <= 48; z += 32) {
      const y = surfaceY(dimension, centerX + x, centerZ + z) + 1;
      for (let layer = 0; layer < 8; layer++) commands.push(`fill ${centerX + x - 8 + layer} ${y + layer} ${centerZ + z - 8 + layer} ${centerX + x + 8 - layer} ${y + layer} ${centerZ + z + 8 - layer} minecraft:sandstone`);
    }
  }

  if (feature === "end_spires") {
    for (let x = -40; x <= 40; x += 40) for (let z = -40; z <= 40; z += 40) {
      const y = surfaceY(dimension, centerX + x, centerZ + z) + 1;
      commands.push(`fill ${centerX + x - 3} ${y} ${centerZ + z - 3} ${centerX + x + 3} ${y + 35} ${centerZ + z + 3} minecraft:obsidian`);
      commands.push(`summon minecraft:ender_crystal ${centerX + x} ${y + 36} ${centerZ + z}`);
    }
    for (let i = 0; i < 24; i++) {
      const x = centerX - 56 + (coordinateHash(i, 33, 7) % 113);
      const z = centerZ - 56 + (coordinateHash(i, 55, 8) % 113);
      commands.push(`setblock ${x} ${surfaceY(dimension, x, z) + 1} ${z} minecraft:chorus_plant`);
    }
  }

  if (feature === "sky_mineshaft") {
    const y = 180;
    for (let n = -56; n <= 56; n += 16) {
      commands.push(`fill ${centerX - 60} ${y} ${centerZ + n} ${centerX + 60} ${y} ${centerZ + n} minecraft:oak_planks`);
      commands.push(`fill ${centerX + n} ${y} ${centerZ - 60} ${centerX + n} ${y} ${centerZ + 60} minecraft:rail`);
      for (let p = -48; p <= 48; p += 24) commands.push(`setblock ${centerX + p} ${y + 3} ${centerZ + n} minecraft:glowstone`);
    }
  }

  if (feature === "vertical_clones") {
    for (let x = bounds.minX; x <= bounds.maxX; x += 16) for (let z = bounds.minZ; z <= bounds.maxZ; z += 16) {
      for (const y of [-64, 129, 213]) commands.push(`clone ${x} ${MIN_Y} ${z} ${x + 15} ${MAX_Y} ${z + 15} ${x} ${y} ${z} masked force`);
    }
  }

  if (["floating_islands", "planets", "coral_sky"].includes(feature)) {
    const centers = [[0, 0, 150], [-38, -34, 150], [0, -38, 174], [38, -25, 145], [-32, 18, 168], [12, 22, 148], [42, 38, 178]];
    const palettes = feature === "planets"
      ? ["red_sandstone", "packed_ice", "moss_block", "amethyst_block", "end_stone", "magma"]
      : feature === "coral_sky"
        ? ["tube_coral_block", "brain_coral_block", "bubble_coral_block", "fire_coral_block", "horn_coral_block", "sea_lantern"]
        : ["grass_block", "stone", "dirt", "moss_block", "snow", "sand"];
    centers.forEach(([lx, lz, y], i) => {
      addSphere(commands, centerX + lx, y, centerZ + lz, feature === "planets" ? 9 : 7, palettes[i % palettes.length]);
      if (feature === "floating_islands") {
        commands.push(`setblock ${centerX + lx} ${y + 8} ${centerZ + lz} minecraft:chest`);
        commands.push(`loot insert ${centerX + lx} ${y + 8} ${centerZ + lz} loot chests/end_city_treasure`);
      }
    });
  }

  if (["hellscape", "cursed", "party", "pride", "horror"].includes(feature)) {
    for (let i = 0; i < 40; i++) {
      const x = centerX - 58 + (coordinateHash(i, 17, 4) % 117);
      const z = centerZ - 58 + (coordinateHash(i, 73, 9) % 117);
      const y = surfaceY(dimension, x, z) + 1;
      if (feature === "hellscape") commands.push(`setblock ${x} ${y} ${z} minecraft:fire`);
      if (feature === "cursed") commands.push(`fill ${x} ${y} ${z} ${x} ${y + 4 + (i % 8)} ${z} minecraft:bone_block`);
      if (feature === "party" || feature === "pride") commands.push(`setblock ${x} ${y} ${z} minecraft:${["red_wool", "orange_wool", "yellow_wool", "lime_wool", "light_blue_wool", "purple_wool"][i % 6]}`);
      if (feature === "horror") commands.push(`fill ${x} ${y} ${z} ${x} ${y + 6} ${z} minecraft:crimson_hyphae`);
    }
  }

  if (["door_maze", "wall_maze", "chest_maze"].includes(feature)) {
    for (let x = -56; x <= 56; x += 8) for (let z = -56; z <= 56; z += 8) {
      if ((coordinateHash(x, 0, z) % 3) === 0) continue;
      const y = surfaceY(dimension, centerX + x, centerZ + z) + 1;
      if (feature === "door_maze") commands.push(`setblock ${centerX + x} ${y} ${centerZ + z} minecraft:iron_door`);
      if (feature === "wall_maze") commands.push(`fill ${centerX + x} ${y} ${centerZ + z} ${centerX + x + (x % 16 ? 6 : 0)} ${y + 4} ${centerZ + z + (x % 16 ? 0 : 6)} minecraft:deepslate_bricks`);
      if (feature === "chest_maze") {
        commands.push(`setblock ${centerX + x} ${y} ${centerZ + z} minecraft:chest`);
        if ((x + z) % 24 === 0) commands.push(`loot insert ${centerX + x} ${y} ${centerZ + z} loot chests/simple_dungeon`);
      }
    }
  }

  runCommandQueue(dimension, commands, done);
}

export function prepareRealityClone(reality, origin, dimension, done) {
  const recipe = getRealityRecipe(reality);
  const bounds = getBounds(reality, origin);
  const commands = replacementCommands(bounds, recipe.replacements ?? []);
  const voidChunks = recipe.voidChunks ?? (recipe.voidChunk ? [recipe.voidChunk] : []);
  for (const chunk of voidChunks) {
    for (let y = OVERWORLD_MIN_Y; y <= OVERWORLD_MAX_Y; y += 64) {
      commands.push(`fill ${bounds.centerX + chunk.minX} ${y} ${bounds.centerZ + chunk.minZ} ${bounds.centerX + chunk.maxX} ${Math.min(y + 63, OVERWORLD_MAX_Y)} ${bounds.centerZ + chunk.maxZ} minecraft:air`);
    }
  }
  runCommandQueue(dimension, commands, () => {
    const finishScan = () => runFeature(dimension, bounds, recipe.feature, done);
    if (recipe.scan) runScan(dimension, bounds, recipe.scan, finishScan);
    else finishScan();
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
  safeCommand(player, "effect @s clear jump_boost");
  safeCommand(player, "effect @s clear slow_falling");
  safeCommand(player, "effect @s clear speed");
}

export function exitReality(player, reality) {
  const recipe = getRealityRecipe(reality);
  if (recipe.fog) safeCommand(player, `fog @s remove ${FOG_STACK_ID}`);
  if (recipe.invertedView) {
    safeCommand(player, "camera @s clear");
    safeCommand(player, "camera @s fov_clear 0.1 linear");
    safeCommand(player, "effect @s clear nausea");
  }
  if (recipe.playerEffect) {
    safeCommand(player, "effect @s clear jump_boost");
    safeCommand(player, "effect @s clear slow_falling");
    safeCommand(player, "effect @s clear speed");
  }
  if (recipe.sunBurn) {
    try { player.extinguishFire(false); } catch { }
  }
  if (recipe.distortedSound || recipe.muteSound) safeCommand(player, "stopsound @s");
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

function limitInventory(player, limit) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (!item || item.amount <= limit) continue;
      let excess = item.amount - limit;
      item.amount = limit;
      container.setItem(slot, item);
      while (excess > 0) {
        let empty = -1;
        for (let target = 0; target < container.size; target++) {
          if (!container.getItem(target)) {
            empty = target;
            break;
          }
        }
        const amount = Math.min(limit, excess);
        const split = item.clone();
        split.amount = amount;
        if (empty >= 0) container.setItem(empty, split);
        else player.dimension.spawnItem(split, player.location);
        excess -= amount;
      }
    }
  } catch { }
}

export function tickRealityEffects(player, reality) {
  const recipe = getRealityRecipe(reality);
  if (recipe.invertedView) {
    const yaw = Math.round(player.getRotation().y);
    safeCommand(player, `camera @s set minecraft:first_person rot 180 ${yaw}`);
    safeCommand(player, "effect @s nausea 2 0 true");
  }
  if (recipe.tntRain) {
    try {
      player.dimension.spawnEntity("minecraft:tnt", {
        x: player.location.x - 8 + Math.random() * 16,
        y: Math.min(player.location.y + 24, OVERWORLD_MAX_Y - 2),
        z: player.location.z - 8 + Math.random() * 16
      });
    } catch { }
  }
  if (recipe.distortedSound) {
    safeCommand(player, "stopsound @s");
    const sounds = ["ambient.cave", "mob.ghast.moan", "random.anvil_land", "mob.endermen.stare"];
    const sound = sounds[Math.floor(Math.random() * sounds.length)];
    const pitch = (0.35 + Math.random() * 1.5).toFixed(2);
    safeCommand(player, `playsound ${sound} @s ~ ~ ~ 0.45 ${pitch}`);
  }
  if (recipe.muteSound) safeCommand(player, "stopsound @s");
  if (recipe.inventoryLimit) limitInventory(player, recipe.inventoryLimit);
  if (recipe.playerEffect === "bounce") safeCommand(player, "effect @s jump_boost 2 4 true");
  if (recipe.playerEffect === "low_gravity") {
    safeCommand(player, "effect @s slow_falling 2 0 true");
    safeCommand(player, "effect @s jump_boost 2 2 true");
  }
  if (recipe.playerEffect === "speed") safeCommand(player, "effect @s speed 2 3 true");
  if (recipe.sunBurn) {
    try {
      const time = world.getTimeOfDay();
      const top = player.dimension.getTopmostBlock({ x: Math.floor(player.location.x), z: Math.floor(player.location.z) });
      if (time < 12000 && (!top || top.location.y <= player.location.y + 1)) player.setOnFire(2, true);
    } catch { }
  }
}

export function getSafeArrival(reality, localX, localZ) {
  const recipe = getRealityRecipe(reality);
  if (recipe.arrival) return { ...recipe.arrival };
  const withHeight = (location) => recipe.arrivalY === undefined ? location : { ...location, y: recipe.arrivalY };
  const voidChunks = recipe.voidChunks ?? (recipe.voidChunk ? [recipe.voidChunk] : []);
  const isVoid = (x, z) => voidChunks.some((chunk) => x >= chunk.minX && x <= chunk.maxX && z >= chunk.minZ && z <= chunk.maxZ);
  if (!isVoid(localX, localZ)) return withHeight({ x: localX, z: localZ });
  for (let radius = 4; radius <= AREA_RADIUS; radius += 4) {
    const candidates = [[localX + radius, localZ], [localX - radius, localZ], [localX, localZ + radius], [localX, localZ - radius]];
    const safe = candidates.find(([x, z]) => Math.abs(x) < AREA_RADIUS - 2 && Math.abs(z) < AREA_RADIUS - 2 && !isVoid(x, z));
    if (safe) return withHeight({ x: safe[0], z: safe[1] });
  }
  return withHeight({ x: 0, z: 0 });
}

function getRealityAt(location) {
  const spawn = world.getDefaultSpawnLocation();
  for (let reality = 0; reality <= MAX_REALITY; reality++) {
    const bounds = getBounds(reality, { x: Math.floor(spawn.x), z: Math.floor(spawn.z) });
    if (location.x >= bounds.minX && location.x <= bounds.maxX &&
      location.z >= bounds.minZ && location.z <= bounds.maxZ) return reality;
  }
  return undefined;
}

function tryEntityCommand(entity, command) {
  try {
    entity.runCommand(command);
    return true;
  } catch {
    return false;
  }
}

function equip(entity, slot, item) {
  tryEntityCommand(entity, `replaceitem entity @s ${slot} 0 ${namespace(item)} 1 0`);
}

function replaceMob(entity, typeId) {
  const location = entity.location;
  const dimension = entity.dimension;
  entity.remove();
  return dimension.spawnEntity(namespace(typeId), location);
}

function handleMobPolicy(entity, policy) {
  const family = entity.getComponent("minecraft:type_family");
  if (!family?.hasTypeFamily("mob") || family.hasTypeFamily("player") || family.hasTypeFamily("inanimate")) return;
  const type = entity.typeId.replace("minecraft:", "");
  if (policy === "none") {
    entity.remove();
    return;
  }
  if (policy === "charged_creepers") {
    const creeper = type === "creeper" ? entity : replaceMob(entity, "creeper");
    try { creeper.triggerEvent("minecraft:become_charged"); } catch { }
    return;
  }
  if (policy === "zombies" && type !== "zombie") {
    handleMobPolicy(replaceMob(entity, "zombie"), policy);
    return;
  }
  if (policy === "zombies") {
    const tools = ["iron_sword", "diamond_axe", "golden_shovel", "crossbow", "trident"];
    equip(entity, "slot.weapon.mainhand", tools[coordinateHash(Math.floor(entity.location.x), 0, Math.floor(entity.location.z)) % tools.length]);
    if (Math.random() < 0.7) equip(entity, "slot.armor.head", "iron_helmet");
    if (Math.random() < 0.5) equip(entity, "slot.armor.chest", "chainmail_chestplate");
    return;
  }
  const netherMobs = ["blaze", "magma_cube", "piglin", "piglin_brute", "wither_skeleton", "hoglin", "zoglin", "ghast"];
  if (policy === "nether" && !netherMobs.includes(type)) {
    replaceMob(entity, netherMobs[coordinateHash(Math.floor(entity.location.x), 2, Math.floor(entity.location.z)) % netherMobs.length]);
    return;
  }
  const endMobs = ["enderman", "endermite", "shulker"];
  if (policy === "end" && !endMobs.includes(type)) {
    replaceMob(entity, endMobs[coordinateHash(Math.floor(entity.location.x), 3, Math.floor(entity.location.z)) % endMobs.length]);
    return;
  }
  if (policy === "husks" && type !== "husk") {
    replaceMob(entity, "husk");
    return;
  }
  if (policy === "bees" && type !== "bee") {
    replaceMob(entity, "bee");
    return;
  }
  if (policy === "dinnerbone") {
    entity.nameTag = "Dinnerbone";
    return;
  }
  if (policy === "armored_hostiles" && family.hasTypeFamily("monster")) {
    const armor = [["slot.armor.head", "netherite_helmet"], ["slot.armor.chest", "netherite_chestplate"], ["slot.armor.legs", "netherite_leggings"], ["slot.armor.feet", "netherite_boots"]];
    for (const [slot, item] of armor) {
      const enchanted = `replaceitem entity @s ${slot} 0 minecraft:${item} 1 0 {"minecraft:enchantments":{"levels":{"minecraft:protection":32767,"minecraft:thorns":32767,"minecraft:unbreaking":32767}}}`;
      if (!tryEntityCommand(entity, enchanted)) equip(entity, slot, item);
    }
    equip(entity, "slot.weapon.mainhand", "netherite_sword");
    tryEntityCommand(entity, "effect @s resistance 999999 255 true");
    tryEntityCommand(entity, "effect @s strength 999999 255 true");
    return;
  }
  if (policy === "nightmare") {
    entity.nameTag = "Dinnerbone";
    tryEntityCommand(entity, "effect @s speed 999999 3 true");
    tryEntityCommand(entity, "effect @s strength 999999 4 true");
    return;
  }
  if (policy === "freaky") {
    if (type.includes("skeleton")) equip(entity, "slot.weapon.mainhand", "netherite_sword");
    if (type === "zombie" || type === "husk" || type === "drowned") equip(entity, "slot.weapon.mainhand", "bow");
    if (type === "pig") entity.nameTag = "Cow";
  }
}

export function initializeRealityAdapter() {
  if (initialized) return;
  initialized = true;
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      const reality = getRealityAt(entity.location);
      if (reality === undefined) return;
      const recipe = getRealityRecipe(reality);
      if (entity.typeId === "minecraft:arrow" && recipe.mobPolicy === "skeleton_wind") {
        const arrowProjectile = entity.getComponent("minecraft:projectile");
        const owner = arrowProjectile?.owner;
        if (!owner?.typeId.includes("skeleton")) return;
        const location = entity.location;
        const velocity = entity.getVelocity();
        const dimension = entity.dimension;
        entity.remove();
        const charge = dimension.spawnEntity("minecraft:wind_charge_projectile", location);
        const chargeProjectile = charge.getComponent("minecraft:projectile");
        if (chargeProjectile) {
          try {
            chargeProjectile.owner = owner;
            chargeProjectile.shoot(velocity);
          } catch {
            charge.applyImpulse(velocity);
          }
        } else charge.applyImpulse(velocity);
        return;
      }
      const policy = recipe.noMobs ? "none" : recipe.mobPolicy;
      if (policy) handleMobPolicy(entity, policy);
    } catch {
      // The entity can become invalid between the spawn event and this callback.
    }
  });
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
      const reality = getRealityAt(event.block.location);
      if (!getRealityRecipe(reality).fullStackDrops) return;
      const typeId = event.brokenBlockPermutation.type.id;
      const sample = new ItemStack(typeId, 1);
      if (sample.maxAmount <= 1) return;
      const bonus = new ItemStack(typeId, sample.maxAmount - 1);
      event.player.dimension.spawnItem(bonus, {
        x: event.block.location.x + 0.5,
        y: event.block.location.y + 0.5,
        z: event.block.location.z + 0.5
      });
    } catch {
      // Some technical blocks have no corresponding inventory item.
    }
  });
}
