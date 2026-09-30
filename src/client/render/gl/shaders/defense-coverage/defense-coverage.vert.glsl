#version 300 es
precision highp float;

// One instanced quad per fortification. The fragment shader trims it to the
// supplied range and filters by tile owner. See DefenseCoveragePass.

layout(location = 0) in vec2 aCorner;  // unit quad corner, [0,1]²
layout(location = 1) in vec4 aFortification; // (tileX, tileY, ownerID, range)

uniform vec2 uMapSize;

flat out vec2 vPostCenter;
flat out float vOwner;
flat out float vRange;

void main() {
  vPostCenter = aFortification.xy;
  vOwner = aFortification.z;
  vRange = aFortification.w;

  // Box spanning [center - range, center + range] in tile coords, plus a
  // 1-tile margin so the boundary tiles at exactly `range` are rasterized
  // (their pixel centers sit just past the un-padded edge).
  vec2 tilePos = aFortification.xy + (aCorner * 2.0 - 1.0) * (vRange + 1.0);

  // Tile-resolution FBO (viewport = map size), so map straight to clip space.
  vec2 ndc = (tilePos / uMapSize) * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
