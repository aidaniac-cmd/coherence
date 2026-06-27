import { system, world } from "@minecraft/server";
import { updatePlayers } from "./realityManager.js";
import { setupRealityClones } from "./cloneManager.js";
import { initializeRealityAdapter } from "./realityAdapter.js";
import { initializePlayerReality } from "./teleport.js";

initializeRealityAdapter();

world.afterEvents.playerSpawn.subscribe((event) => {
  initializePlayerReality(event.player);
  event.player.sendMessage("§aScript is running!");
  if (event.initialSpawn) setupRealityClones();
});

system.runInterval(() => {
  updatePlayers();
}, 10);
