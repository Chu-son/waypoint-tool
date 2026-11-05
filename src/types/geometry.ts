/** A position and heading in the plane: meters and radians (counter-clockwise). */
export interface Pose2D {
  x: number;
  y: number;
  yaw: number;
}

export type Transform = {
  x: number;
  y: number;
  z?: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
};
