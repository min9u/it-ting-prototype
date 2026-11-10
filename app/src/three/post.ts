import * as THREE from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

const VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'

/** 방 색보정: 채도 살짝 낮춤 + 따뜻하게 + S커브 + 비네트 + 필름 그레인 (알파 유지) */
export function roomGradePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec4 src = texture2D(tDiffuse,vUv);
        vec3 c = src.rgb;
        float l = dot(c,vec3(.299,.587,.114));
        c = mix(vec3(l), c, .86);
        c = c*vec3(1.0,.985,.96) + vec3(.02,.012,.006);
        c = mix(c, smoothstep(0.,1.,c), .25);
        float d = distance(vUv, vec2(.5,.45));
        c *= 1. - smoothstep(.45,.95,d)*.22;
        c += (h(vUv*uRes + uTime) - .5) * .045;
        // 투명한 곳(방 바깥)에는 색을 남기지 않음 → 뒤 배경색이 그대로 보이게
        gl_FragColor = vec4(c * step(0.002, src.a), src.a);
      }`,
  })
}

/** 밭 색보정: 아주 약한 S커브 + 그레인 */
export function fieldGradePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse,vUv).rgb;
        float l = dot(c,vec3(.299,.587,.114));
        c = mix(vec3(l), c, .97);
        c = mix(c, smoothstep(0.,1.,c), .15);
        c += (h(vUv*uRes) - .5) * .02;
        gl_FragColor = vec4(c, 1.);
      }`,
  })
}
