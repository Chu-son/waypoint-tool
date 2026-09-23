export type CircularFootprint = {
  type: 'circular';
  radius: number; // in meters
};

export type RectangularFootprint = {
  type: 'rectangular';
  length: number; // X direction (front-to-back, in meters)
  width: number; // Y direction (left-to-right, in meters)
  offset_x?: number; // Offset of robot center from footprint origin (in meters)
  offset_y?: number; // Offset of robot center from footprint origin (in meters)
};

export type PolygonFootprint = {
  type: 'polygon';
  points: Array<[number, number]>; // [[x, y], ...] in robot local frame (in meters)
};

export type RobotFootprint = CircularFootprint | RectangularFootprint | PolygonFootprint;
