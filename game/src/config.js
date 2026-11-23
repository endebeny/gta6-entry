// Solmar Bay — tuning numbers and city layout in one place.
// The city is a road grid: BLOCK-sized blocks separated by ROAD-wide streets.
// Roads run along both axes; their centrelines are at multiples of PITCH.
export const BLOCK = 56;
export const ROAD = 16;
export const PITCH = BLOCK + ROAD; // 72
export const GRID = 6; // blocks per side
export const HALF = (GRID * PITCH + ROAD) / 2; // city edge, 224
export const ROAD_CENTRES = [-216, -144, -72, 0, 72, 144, 216]; // gaps between blocks

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarbay.save.v1';
export const BEST_KEY = 'solmarbay.best.v1';

export const PLAYER_WALK = 6;
export const PLAYER_RUN = 10;
export const CAR_ACCEL = 16;
export const CAR_BRAKE = 34;
export const CAR_MAX_SPEED = 38;
export const CAR_MAX_REVERSE = 12;
export const CAR_TURN = 1.9;

export const TRAFFIC_COUNT = 10;
export const PARKED_COUNT = 9;
export const PED_COUNT = 16;
export const MAX_WANTED = 5;

export const PISTOL_DAMAGE = 34;
export const PUNCH_DAMAGE = 25;
export const PUNCH_RANGE = 2.4;

// Colours of the city palette: warm concrete, pastel walls, sunset sky.
export const PALETTE = {
  ground: 0x8a7f6a,
  sidewalk: 0xb8ab90,
  road: 0x2e2e33,
  line: 0xd8c86a,
  water: 0x2e7f9e,
  sand: 0xe0c98f,
  building: [0xe8d8b8, 0xd8b8a0, 0xc8d0d8, 0xe0c0a8, 0xb8c8b0, 0xd8a8a0, 0xc0b8d0, 0xe8e0c8],
  roof: 0x6a5a48,
};
