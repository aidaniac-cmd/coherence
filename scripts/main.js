import { system } from "@minecraft/server";
import { updatePlayers } from "./realityManager.js";
import { world } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe((event) => {
    event.player.sendMessage("§aScript is running!");
});

system.runInterval(() => {
  updatePlayers();
}, 10);