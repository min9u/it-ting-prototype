/** 하드웨어 가속이 꺼졌는지(소프트웨어 렌더링인지) 페이지에서 알아보는 방법들 */
export async function detectGpu() {
  const r: Record<string, unknown> = {}
  // 1) WebGL 렌더러 문자열
  for (const kind of ['webgl2', 'webgl'] as const) {
    const c = document.createElement('canvas')
    const gl = c.getContext(kind) as WebGLRenderingContext | null
    if (!gl) { r[kind] = null; continue }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    r[kind] = {
      renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
      unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '(ext 없음)',
      unmaskedVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '(ext 없음)',
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  // 2) failIfMajorPerformanceCaveat: 소프트웨어 렌더러면 컨텍스트를 안 줌
  for (const kind of ['webgl', 'webgl2'] as const) {
    const c = document.createElement('canvas')
    const gl = c.getContext(kind, { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null
    r['caveat_' + kind] = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  // 3) WebGPU 어댑터
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ info?: Record<string, unknown>; isFallbackAdapter?: boolean } | null> } }).gpu
    if (!gpu) r.webgpu = 'navigator.gpu 없음'
    else {
      const a = await gpu.requestAdapter()
      r.webgpu = a ? { vendor: a.info?.vendor, architecture: a.info?.architecture, description: a.info?.description, infoFallback: a.info?.isFallbackAdapter, isFallbackAdapter: a.isFallbackAdapter } : 'adapter null'
    }
  } catch (e) { r.webgpu = 'error ' + e }
  // 4) 속도 시험: 1024x1024에 무거운 셰이더 10번 그리고 끝날 때까지 기다린 시간(ms)
  r.microMs = microBench()
  return r
}

export function microBench() {
  const c = document.createElement('canvas'); c.width = c.height = 1024
  const gl = c.getContext('webgl')
  if (!gl) return null
  const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o }
  const p = gl.createProgram()!
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'))
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform float u;void main(){vec2 q=gl_FragCoord.xy/1024.;float v=0.;for(int i=0;i<24;i++){v+=sin(q.x*float(i)+u)*cos(q.y*float(i));}gl_FragColor=vec4(v,q,1.);}'))
  gl.linkProgram(p); gl.useProgram(p)
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const px = new Uint8Array(4), u = gl.getUniformLocation(p, 'u')
  gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) // 워밍업
  const s = performance.now()
  for (let i = 0; i < 10; i++) { gl.uniform1f(u, i); gl.drawArrays(gl.TRIANGLES, 0, 3) }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const ms = performance.now() - s
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return Math.round(ms * 10) / 10
}
