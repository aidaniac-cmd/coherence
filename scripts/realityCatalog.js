const remove = (...blocks) => blocks.map((block) => [block, "air"]);
const swap = (from, to) => [[from, to]];

const FLOWERS = [
  "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip",
  "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy", "cornflower",
  "lily_of_the_valley", "sunflower", "lilac", "rose_bush", "peony",
  "torchflower", "pitcher_plant", "wither_rose"
];
const FLORA = [...FLOWERS, "short_grass", "tall_grass", "fern", "large_fern", "deadbush", "seagrass", "tall_seagrass", "vine", "glow_lichen", "moss_carpet", "pink_petals", "wildflowers", "leaf_litter", "bush", "firefly_bush", "cactus_flower", "spore_blossom", "hanging_roots", "crimson_roots", "warped_roots", "nether_sprouts", "brown_mushroom", "red_mushroom"];
const LIGHTS = ["torch", "soul_torch", "redstone_torch", "lantern", "soul_lantern", "glowstone", "sea_lantern", "shroomlight", "ochre_froglight", "verdant_froglight", "pearlescent_froglight", "jack_o_lantern", "campfire", "soul_campfire", "end_rod", "beacon", "light_block", "lava", "fire", "soul_fire", "magma", "redstone_lamp", "respawn_anchor", "conduit", "end_portal", "portal", "candle", "white_candle", "orange_candle", "magenta_candle", "light_blue_candle", "yellow_candle", "lime_candle", "pink_candle", "gray_candle", "light_gray_candle", "cyan_candle", "purple_candle", "blue_candle", "brown_candle", "green_candle", "red_candle", "black_candle"];

const SLABS = [
  ["oak", "oak_planks"], ["spruce", "spruce_planks"], ["birch", "birch_planks"],
  ["jungle", "jungle_planks"], ["acacia", "acacia_planks"], ["dark_oak", "dark_oak_planks"],
  ["mangrove", "mangrove_planks"], ["cherry", "cherry_planks"], ["bamboo", "bamboo_planks"],
  ["crimson", "crimson_planks"], ["warped", "warped_planks"], ["cobblestone", "cobblestone"],
  ["brick", "bricks"], ["stone_brick", "stone_bricks"], ["mud_brick", "mud_bricks"],
  ["nether_brick", "nether_bricks"], ["quartz", "quartz_block"], ["purpur", "purpur_block"],
  ["blackstone", "blackstone"], ["cobbled_deepslate", "cobbled_deepslate"],
  ["polished_deepslate", "polished_deepslate"], ["deepslate_brick", "deepslate_bricks"],
  ["deepslate_tile", "deepslate_tiles"]
].map(([kind, block]) => [`${kind}_slab`, block]);

const STAIRS = [
  ["oak", "oak_planks"], ["spruce", "spruce_planks"], ["birch", "birch_planks"],
  ["jungle", "jungle_planks"], ["acacia", "acacia_planks"], ["dark_oak", "dark_oak_planks"],
  ["mangrove", "mangrove_planks"], ["cherry", "cherry_planks"], ["bamboo", "bamboo_planks"],
  ["crimson", "crimson_planks"], ["warped", "warped_planks"], ["stone", "stone"],
  ["cobblestone", "cobblestone"], ["brick", "bricks"], ["stone_brick", "stone_bricks"],
  ["sandstone", "sandstone"], ["red_sandstone", "red_sandstone"],
  ["nether_brick", "nether_bricks"], ["quartz", "quartz_block"], ["purpur", "purpur_block"],
  ["prismarine", "prismarine"], ["dark_prismarine", "dark_prismarine"],
  ["blackstone", "blackstone"], ["cobbled_deepslate", "cobbled_deepslate"],
  ["polished_deepslate", "polished_deepslate"], ["deepslate_brick", "deepslate_bricks"],
  ["deepslate_tile", "deepslate_tiles"], ["mud_brick", "mud_bricks"]
].map(([kind, block]) => [`${kind}_stairs`, block]);

const GLASS_PANES = ["glass", "white_stained_glass", "orange_stained_glass", "magenta_stained_glass", "light_blue_stained_glass", "yellow_stained_glass", "lime_stained_glass", "pink_stained_glass", "gray_stained_glass", "light_gray_stained_glass", "cyan_stained_glass", "purple_stained_glass", "blue_stained_glass", "brown_stained_glass", "green_stained_glass", "red_stained_glass", "black_stained_glass"].map((glass) => [glass === "glass" ? "glass_pane" : `${glass}_pane`, glass]);

export const WOOL_PALETTE = ["white_wool", "orange_wool", "magenta_wool", "light_blue_wool", "yellow_wool", "lime_wool", "pink_wool", "gray_wool", "light_gray_wool", "cyan_wool", "purple_wool", "blue_wool", "brown_wool", "green_wool", "red_wool", "black_wool"];
export const RANDOM_BLOCK_PALETTE = ["stone", "dirt", "oak_planks", "bricks", "glass", "obsidian", "slime", "honey_block", "amethyst_block", "prismarine", "purpur_block", "magma", "packed_ice", "sponge", "redstone_block", "emerald_block"];
export const LIGHT_PALETTE = ["glowstone", "sea_lantern", "shroomlight", "ochre_froglight", "verdant_froglight", "pearlescent_froglight", "redstone_lamp", "jack_o_lantern"];
export const PRIDE_PALETTE = ["red_wool", "orange_wool", "yellow_wool", "lime_wool", "light_blue_wool", "purple_wool", "pink_wool", "white_wool", "cyan_wool", "brown_wool", "black_wool"];

const chunks = (...pairs) => pairs.map(([x, z]) => ({ minX: x, maxX: x + 15, minZ: z, maxZ: z + 15 }));
const FIVE_VOIDS = chunks([-32, -32], [0, -32], [32, -32], [-16, 16], [32, 16]);
const CHECKER_VOIDS = [];
const BORDER_VOIDS = [];
for (let x = -64; x < 64; x += 16) {
  for (let z = -64; z < 64; z += 16) {
    if ((((x + 64) / 16) + ((z + 64) / 16)) % 2 === 0) CHECKER_VOIDS.push(...chunks([x, z]));
    const edge = x === -64 || x === 48 || z === -64 || z === 48;
    const gateway = ((x === -64 || x === 48) && (z === -16 || z === 0)) ||
      ((z === -64 || z === 48) && (x === -16 || x === 0));
    if (edge && !gateway) BORDER_VOIDS.push(...chunks([x, z]));
  }
}

const INVERTED_BLOCKS = [["blue_wool", "orange_wool"], ["orange_wool", "blue_wool"], ["red_wool", "cyan_wool"], ["cyan_wool", "red_wool"], ["yellow_wool", "purple_wool"], ["purple_wool", "yellow_wool"], ["black_wool", "white_wool"], ["white_wool", "black_wool"], ["dark_oak_log", "pale_oak_log"], ["dark_oak_planks", "pale_oak_planks"], ["stone", "quartz_block"], ["deepslate", "calcite"], ["dirt", "snow"], ["grass_block", "pink_wool"], ["water", "lava"], ["lava", "water"]];

export const REALITY_RECIPES = new Map([
  [0, { name: "Original" }],
  [1, { name: "Perfect copy" }],
  [2, { name: "Gravel sand", replacements: swap("sand", "gravel") }],
  [3, { name: "No flowers", replacements: remove(...FLOWERS) }],
  [4, { name: "Thick windows", replacements: GLASS_PANES }],
  [5, { name: "No slabs", replacements: SLABS }],
  [6, { name: "No stairs", replacements: STAIRS }],
  [7, { name: "Silent world", noMobs: true }],
  [8, { name: "Missing pieces", scan: { type: "random_air", count: 250 } }],
  [9, { name: "Spruce impostors", replacements: swap("oak_log", "spruce_log") }],
  [10, { name: "No flora", replacements: remove(...FLORA) }],
  [11, { name: "Cobble stone", replacements: swap("stone", "cobblestone") }],
  [12, { name: "Red torches", replacements: swap("torch", "redstone_torch") }],
  [13, { name: "Lightless", replacements: remove(...LIGHTS) }],
  [14, { name: "Bedrock fog", fog: "coherence:bedrock_fog" }],
  [15, { name: "Missing chunk", voidChunk: { minX: 0, maxX: 15, minZ: 0, maxZ: 15 } }],
  [16, { name: "Dead lawn", replacements: swap("grass_block", "dirt") }],
  [17, { name: "Cobble everything", scan: { type: "solidify", block: "cobblestone" } }],
  [18, { name: "Lava water", replacements: swap("water", "lava") }],
  [19, { name: "Crimson fog", fog: "coherence:crimson_fog" }],
  [20, { name: "Sickly fog", fog: "coherence:sickly_fog" }],
  [21, { name: "Violet fog", fog: "coherence:violet_fog" }],
  [22, { name: "Golden fog", fog: "coherence:golden_fog" }],
  [23, { name: "Inverted view", invertedView: true }],
  [24, { name: "Leafless", replacements: remove("oak_leaves", "spruce_leaves", "birch_leaves", "jungle_leaves", "acacia_leaves", "dark_oak_leaves", "mangrove_leaves", "cherry_leaves", "azalea_leaves", "flowering_azalea_leaves") }],
  [25, { name: "Coarse earth", replacements: swap("dirt", "coarse_dirt") }],
  [26, { name: "Mycelium lawn", replacements: swap("grass_block", "mycelium") }],
  [27, { name: "Birch oak", replacements: swap("oak_planks", "birch_planks") }],
  [28, { name: "Red wool", replacements: swap("white_wool", "red_wool") }],
  [29, { name: "Cracked masonry", replacements: swap("stone_bricks", "cracked_stone_bricks") }],
  [30, { name: "Dense ice", replacements: swap("ice", "packed_ice") }],
  [31, { name: "No snow", replacements: remove("snow", "snow_layer", "powder_snow") }],
  [32, { name: "Cobble fences", replacements: swap("oak_fence", "cobblestone_wall") }],
  [33, { name: "Iron doors", replacements: swap("oak_door", "iron_door") }],
  [34, { name: "Living ladders", replacements: swap("ladder", "vine") }],
  [35, { name: "Hay library", replacements: swap("bookshelf", "hay_block") }],
  [36, { name: "Barrel chests", replacements: swap("chest", "barrel") }],
  [37, { name: "No cobwebs", replacements: remove("web") }],
  [38, { name: "Nether bricks", replacements: swap("bricks", "nether_bricks") }],
  [39, { name: "Fired clay", replacements: swap("clay", "terracotta") }],
  [40, { name: "Five holes", voidChunks: FIVE_VOIDS }],
  [41, { name: "Golden strata", scan: { type: "gold_layers" }, fog: "coherence:golden_fog" }],
  [42, { name: "Slime lawn", replacements: swap("grass_block", "slime"), fog: "coherence:green_fog" }],
  [43, { name: "Charged creepers", mobPolicy: "charged_creepers" }],
  [44, { name: "Impossible suburb", feature: "houses" }],
  [45, { name: "Loot fever", feature: "loot_chests" }],
  [46, { name: "Checker void", voidChunks: CHECKER_VOIDS }],
  [47, { name: "Zombie tools", mobPolicy: "zombies" }],
  [48, { name: "False End", replacements: [["grass_block", "end_stone"], ["dirt", "end_stone"], ["stone", "end_stone"], ["water", "air"], ["oak_log", "obsidian"]], feature: "end_spires", mobPolicy: "end", fog: "coherence:end_fog" }],
  [49, { name: "TNT weather", tntRain: true, fog: "coherence:storm_fog" }],
  [50, { name: "Overpowered hostiles", mobPolicy: "armored_hostiles" }],
  [51, { name: "Wool static", scan: { type: "palette", palette: WOOL_PALETTE } }],
  [52, { name: "Pyramid field", feature: "pyramids" }],
  [53, { name: "Chunk marbles", scan: { type: "chunk_spheres" }, arrival: { x: 7, y: 99, z: 7 } }],
  [54, { name: "Sky mineshaft", feature: "sky_mineshaft", fog: "coherence:black_fog" }],
  [55, { name: "Black fog", fog: "coherence:black_fog" }],
  [56, { name: "Wrong audio", distortedSound: true }],
  [57, { name: "Cardboard world", scan: { type: "palette", palette: ["white_concrete", "light_blue_concrete", "lime_concrete", "yellow_concrete", "pink_concrete"] }, fog: "coherence:cartoon_fog" }],
  [58, { name: "Pocket Nether", replacements: [["grass_block", "netherrack"], ["dirt", "netherrack"], ["water", "lava"]], mobPolicy: "nether", fog: "coherence:nether_fog" }],
  [59, { name: "World border void", voidChunks: BORDER_VOIDS }],
  [60, { name: "Diamond dream", scan: { type: "solidify", block: "diamond_block" }, fog: "coherence:blue_fog" }],
  [61, { name: "Block randomizer", scan: { type: "palette", palette: RANDOM_BLOCK_PALETTE } }],
  [62, { name: "Hell", replacements: [["grass_block", "netherrack"], ["dirt", "soul_soil"], ["water", "lava"], ["sand", "magma"]], feature: "hellscape", mobPolicy: "nether", fog: "coherence:hell_fog" }],
  [63, { name: "Cursed", scan: { type: "palette", palette: ["furnace", "cake", "web", "soul_sand", "crying_obsidian", "bone_block"] }, feature: "cursed", distortedSound: true, fog: "coherence:horror_fog" }],
  [64, { name: "Stack drops", fullStackDrops: true }],
  [65, { name: "Treasure islands", feature: "floating_islands", fog: "coherence:sky_fog" }],
  [66, { name: "Husk desert", replacements: swap("grass_block", "sand"), mobPolicy: "husks" }],
  [67, { name: "Seven is plenty", inventoryLimit: 7 }],
  [68, { name: "Dinnerbone world", mobPolicy: "dinnerbone" }],
  [69, { name: "Planetarium", scan: { type: "clear" }, feature: "planets", fog: "coherence:space_fog", arrival: { x: 0, y: 160, z: 0 } }],
  [70, { name: "Everything random", scan: { type: "palette", palette: [...RANDOM_BLOCK_PALETTE, ...WOOL_PALETTE, ...LIGHT_PALETTE] } }],
  [71, { name: "Absolute silence", muteSound: true }],
  [72, { name: "Water matter", scan: { type: "solidify", block: "water" } }],
  [73, { name: "Negative world", replacements: INVERTED_BLOCKS, fog: "coherence:contrast_fog" }],
  [74, { name: "Bounce house", scan: { type: "palette", palette: ["slime", "honey_block", "sponge", "pink_wool", "lime_wool"] }, feature: "party", playerEffect: "bounce" }],
  [75, { name: "Pride dimension", scan: { type: "stripes", palette: PRIDE_PALETTE }, feature: "pride", fog: "coherence:pride_fog" }],
  [76, { name: "Yellow", scan: { type: "palette", palette: ["yellow_wool", "yellow_concrete", "gold_block", "honeycomb_block", "sponge", "ochre_froglight"] }, fog: "coherence:yellow_fog" }],
  [77, { name: "The nightmare", replacements: [["grass_block", "sculk"], ["dirt", "soul_sand"], ["water", "black_concrete"]], feature: "horror", mobPolicy: "nightmare", distortedSound: true, fog: "coherence:horror_fog" }],
  [78, { name: "Cruel sun", sunBurn: true, fog: "coherence:bleached_fog" }],
  [79, { name: "Wind skeletons", mobPolicy: "skeleton_wind" }],
  [80, { name: "Freaky Friday", mobPolicy: "freaky" }],
  [81, { name: "Chunk pillars", scan: { type: "chunk_pillars" } }],
  [82, { name: "Vertical echoes", feature: "vertical_clones" }],
  [83, { name: "Living light", scan: { type: "palette", palette: LIGHT_PALETTE }, fog: "coherence:light_fog" }],
  [84, { name: "Low gravity", playerEffect: "low_gravity", fog: "coherence:sky_fog" }],
  [85, { name: "Emerald fever", scan: { type: "solidify", block: "emerald_block" }, playerEffect: "speed" }],
  [86, { name: "Giant chessboard", scan: { type: "chunk_checker", palette: ["quartz_block", "black_concrete"] } }],
  [87, { name: "Redstone pulse", scan: { type: "palette", palette: ["redstone_block", "redstone_lamp", "observer", "target"] }, fog: "coherence:crimson_fog" }],
  [88, { name: "Target practice", scan: { type: "palette", palette: ["target", "hay_block"] }, mobPolicy: "skeleton_wind" }],
  [89, { name: "Slime gravity", scan: { type: "solidify", block: "slime" }, playerEffect: "bounce" }],
  [90, { name: "Invisible architecture", replacements: [["stone", "glass"], ["dirt", "glass"], ["grass_block", "glass"], ["oak_planks", "glass"]], fog: "coherence:white_fog" }],
  [91, { name: "Drowned sponge", scan: { type: "palette", palette: ["wet_sponge", "prismarine", "water"] }, fog: "coherence:blue_fog" }],
  [92, { name: "Coral sky", scan: { type: "clear" }, feature: "coral_sky", fog: "coherence:pride_fog", arrival: { x: 0, y: 158, z: 0 } }],
  [93, { name: "Red glass fever", scan: { type: "palette", palette: ["red_stained_glass", "redstone_block", "red_wool"] }, fog: "coherence:crimson_fog" }],
  [94, { name: "Door maze", feature: "door_maze" }],
  [95, { name: "Wall maze", feature: "wall_maze", fog: "coherence:black_fog" }],
  [96, { name: "End rod forest", scan: { type: "palette", palette: ["end_rod", "purpur_block", "end_stone"] }, fog: "coherence:end_fog" }],
  [97, { name: "Last islands", scan: { type: "clear" }, feature: "floating_islands", fog: "coherence:space_fog", arrival: { x: 0, y: 158, z: 0 } }],
  [98, { name: "Bee planet", scan: { type: "palette", palette: ["honey_block", "honeycomb_block", "bee_nest", "yellow_wool"] }, mobPolicy: "bees", fog: "coherence:yellow_fog" }],
  [99, { name: "Chest labyrinth", feature: "chest_maze" }],
  [100, { name: "Final blackout", scan: { type: "solidify", block: "blackstone" }, fog: "coherence:black_fog", mobPolicy: "nightmare", distortedSound: true }]
]);

export function getRealityRecipe(reality) {
  return REALITY_RECIPES.get(reality) ?? { name: `Reality ${reality}` };
}
