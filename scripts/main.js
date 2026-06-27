import { system, world } from "@minecraft/server";
import { updatePlayers } from "./realityManager.js";
import { setupRealityClones } from "./cloneManager.js";

world.afterEvents.playerSpawn.subscribe((event) => {
  event.player.sendMessage("§aScript is running!");
  if (event.initialSpawn) setupRealityClones();
});

system.runInterval(() => {
  updatePlayers();
}, 10);
