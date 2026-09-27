#version 300 es
precision highp float;

uniform sampler2D uPalette;
uniform float uAlpha;

in vec2 vPixel;
flat in float vOwnerID;
out vec4 fragColor;

void main() {
  // Two 5×8 silhouettes side-by-side form a tiny, readable pixel-art squad.
  ivec2 pixel = ivec2(floor(vPixel * vec2(10.0, 8.0)));
  int x = pixel.x;
  int y = pixel.y;
  bool first = x <= 4;
  int localX = first ? x : x - 5;
  bool head = (localX == 2 || localX == 3) && y <= 1;
  bool helmet = localX >= 1 && localX <= 4 && y == 2;
  bool body = localX >= 1 && localX <= 4 && y >= 3 && y <= 5;
  bool legs = ((localX == 1 || localX == 2) && y >= 6) ||
    ((localX == 3 || localX == 4) && y >= 6);
  if (!(head || helmet || body || legs)) discard;

  float paletteX = (vOwnerID + 0.5) / float(PALETTE_SIZE);
  vec3 color = texture(uPalette, vec2(paletteX, 0.25)).rgb;
  if (head) {
    color = min(color * 1.2 + vec3(0.08), vec3(1.0));
  } else if (legs) {
    color *= 0.5;
  } else if (helmet) {
    color *= 0.72;
  }
  fragColor = vec4(color, uAlpha);
}
