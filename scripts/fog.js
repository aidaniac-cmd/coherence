export function isInFog(location, radius) {
  return (
    location.x >= radius ||
    location.x < -radius ||
    location.z >= radius ||
    location.z < -radius
  );
}

export function applyFogEffects(player, location, radius) {
  const nearFog =
    Math.abs(location.x) > radius - 10 ||
    Math.abs(location.z) > radius - 10;
  if (!nearFog) return;

  player.runCommand("effect @s blindness 2 1 true");
  player.runCommand("effect @s darkness 2 0 true");
}
