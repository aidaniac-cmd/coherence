export const AREA_SIZE = 128;
export const AREA_RADIUS = AREA_SIZE / 2;
export const MIN_Y = 45;
export const MAX_Y = 128;

export const MAX_REALITY = 100;
export const REALITY_GRID_COLUMNS = 10;
export const REALITY_SPACING = 100000;

// Fixed offsets relative to the world's default spawn.
export const REALITY_COORDINATES = new Map([[0, { x: 0, z: 0 }]]);

for (let reality = 1; reality <= MAX_REALITY; reality++) {
  const gridIndex = reality - 1;
  const column = gridIndex % REALITY_GRID_COLUMNS;
  const row = Math.floor(gridIndex / REALITY_GRID_COLUMNS);
  REALITY_COORDINATES.set(reality, {
    x: (column + 1) * REALITY_SPACING,
    z: (row + 1) * REALITY_SPACING
  });
}

export function getRealityOffset(reality) {
  const offset = REALITY_COORDINATES.get(reality);
  if (!offset) throw new Error(`Unknown reality ${reality}`);
  return offset;
}

export function getNextRealityId(reality) {
  return reality >= MAX_REALITY ? 0 : reality + 1;
}
