#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec3 aInstance; // tileX, tileY, ownerID

uniform mat3 uCamera;
uniform float uUnitSize;

out vec2 vPixel;
flat out float vOwnerID;

void main() {
  vec2 worldPos = aInstance.xy + vec2(0.5) + (aPosition - vec2(0.5)) * uUnitSize;
  vec3 clip = uCamera * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vPixel = aPosition;
  vOwnerID = aInstance.z;
}
