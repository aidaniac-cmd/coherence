const REALITY_OFFSETS = [
  { x: 0, z: 0 },
  { x: 100000, z: 100000 }
];

const playerReality = new Map();

export function switchReality(player, radius) {
  const id = player.id;
  const currentReality = playerReality.get(id) ?? 0;
  const nextReality = currentReality === 0 ? 1 : 0;

  const currentOffset = REALITY_OFFSETS[currentReality];
  const nextOffset = REALITY_OFFSETS[nextReality];

  const localX = player.location.x - currentOffset.x;
  const localZ = player.location.z - currentOffset.z;

  let newLocalX = localX;
  let newLocalZ = localZ;

  if (localX > radius) newLocalX = -radius + 3;
  if (localX < -radius) newLocalX = radius - 3;
  if (localZ > radius) newLocalZ = -radius + 3;
  if (localZ < -radius) newLocalZ = radius - 3;

  player.teleport({
    x: nextOffset.x + newLocalX,
    y: player.location.y,
    z: nextOffset.z + newLocalZ
  });

  playerReality.set(id, nextReality);
  player.sendMessage(`§8You entered Reality ${nextReality}`);
}