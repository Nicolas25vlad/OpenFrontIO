import type { PlayerState } from "../../types";
import type { RenderSettings } from "../RenderSettings";
import { getPaletteSize } from "../utils/ColorUtils";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import { deriveTroopGarrisons } from "./TroopGarrisons";

import troopFragSrc from "../shaders/troop-garrison/troop-garrison.frag.glsl?raw";
import troopVertSrc from "../shaders/troop-garrison/troop-garrison.vert.glsl?raw";

const FLOATS_PER_INSTANCE = 3;

/** Pixel-art squads placed on owned borders. The pass is view-only. */
export class TroopGarrisonPass {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly quadBuffer: WebGLBuffer;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly uCamera: WebGLUniformLocation;
  private readonly uPalette: WebGLUniformLocation;
  private readonly uUnitSize: WebGLUniformLocation;
  private readonly uAlpha: WebGLUniformLocation;
  private readonly data: Float32Array;
  private count = 0;
  private dirty = false;
  private tileState: Uint16Array | null = null;
  private lastLayoutTick = -Infinity;
  private needsRefresh = true;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly paletteTex: WebGLTexture,
    private readonly settings: RenderSettings,
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.program = createProgram(
      gl,
      troopVertSrc,
      shaderSrc(troopFragSrc, { PALETTE_SIZE: getPaletteSize() }),
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uPalette = gl.getUniformLocation(this.program, "uPalette")!;
    this.uUnitSize = gl.getUniformLocation(this.program, "uUnitSize")!;
    this.uAlpha = gl.getUniformLocation(this.program, "uAlpha")!;
    this.data = new Float32Array(
      settings.troopGarrison.maxInstances * FLOATS_PER_INSTANCE,
    );

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      dataByteLength(settings.troopGarrison.maxInstances),
      gl.DYNAMIC_DRAW,
    );
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FLOATS_PER_INSTANCE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }

  setTileState(tileState: Uint16Array): void {
    this.tileState = tileState;
  }

  updatePlayers(players: ReadonlyMap<number, PlayerState>, tick: number): void {
    if (!this.settings.passEnabled.troopGarrison) {
      this.needsRefresh = true;
      return;
    }
    if (
      this.tileState === null ||
      (!this.needsRefresh &&
        tick >= this.lastLayoutTick &&
        tick - this.lastLayoutTick < this.settings.troopGarrison.refreshTicks)
    ) {
      return;
    }
    const layout = deriveTroopGarrisons(
      this.tileState,
      this.mapWidth,
      this.mapHeight,
      players,
    );
    this.lastLayoutTick = tick;
    this.needsRefresh = false;
    this.count = Math.min(
      layout.count,
      this.settings.troopGarrison.maxInstances,
    );
    this.data.set(
      layout.instances.subarray(0, this.count * FLOATS_PER_INSTANCE),
    );
    this.dirty = true;
  }

  draw(camera: Float32Array, zoom: number): void {
    const config = this.settings.troopGarrison;
    if (this.count === 0 || zoom < config.minZoom) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, camera);
    gl.uniform1f(this.uUnitSize, config.unitSize);
    gl.uniform1f(this.uAlpha, config.alpha);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.uniform1i(this.uPalette, 0);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    if (this.dirty) {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.data.subarray(0, this.count * FLOATS_PER_INSTANCE),
      );
      this.dirty = false;
    }
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.quadBuffer);
    this.gl.deleteBuffer(this.instanceBuffer);
  }
}

function dataByteLength(maxInstances: number): number {
  return maxInstances * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
}
