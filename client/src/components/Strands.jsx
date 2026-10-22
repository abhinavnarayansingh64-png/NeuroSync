import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef, useState } from 'react'
import './Strands.css'

const MAX_STRANDS = 8
const MAX_COLORS = 6

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}];
uniform int uColorCount;
uniform int uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;
out vec4 fragColor;
const float PI = 3.14159265;

vec3 samplePalette(float t) {
  t = fract(t);
  float scaled = t * float(uColorCount);
  int idx = int(floor(scaled));
  float blend = fract(scaled);
  int nextIdx = idx + 1;
  if (nextIdx >= uColorCount) nextIdx = 0;
  return mix(uColors[idx], uColors[nextIdx], blend);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);
  float energy = 0.06 + uIntensity * 0.94;
  float envelope = pow(max(cos(uv.x * PI * 1.28), 0.0), uTaper);
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    if (i >= uStrandCount) break;
    float fi = float(i);
    float phase = fi * 1.7 * uSpread;
    float frequency = (2.0 + fi * 0.35) * uWaviness;
    float travel = 1.4 + fi * 1.2;
    float t = uTime * uSpeed;
    float wave = sin(uv.x * frequency + t * travel + phase) * 0.60
      + sin(uv.x * frequency * 1.1 - t * travel * 0.7 + phase * 1.7) * 0.40;
    float y = wave * (0.1 + 0.02 * energy) * envelope * uAmplitude;
    float d = abs(uv.y - y);
    float thickness = (0.001 + 0.05 * energy) * (0.35 + envelope) * uThickness;
    float glow = thickness / (d + thickness * 0.45);
    glow *= glow;
    col += samplePalette(fi / float(uStrandCount) + uv.x * 0.3 + uTime * 0.04) * glow * envelope;
  }
  col *= 0.45 + 0.7 * energy;
  col = 1.0 - exp(-col * uGlow);
  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(gray), col, uSaturation), 0.0);
  float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * uOpacity, alpha);
}
`

const palette = (colors) => {
  const source = colors?.length ? colors : ['#ffffff']
  return Array.from({ length: MAX_COLORS }, (_, index) => {
    const color = new Color(source[index] ?? source[source.length - 1])
    return [color.r, color.g, color.b]
  })
}

export function Strands({
  colors = ['#ffffff', '#e8ddcd', '#d7c8b6'],
  count = 4,
  speed = 0.3,
  amplitude = 0.82,
  waviness = 0.9,
  thickness = 0.42,
  glow = 1.35,
  taper = 2.4,
  spread = 0.78,
  intensity = 0.54,
  saturation = 0,
  opacity = 0.68,
  scale = 1.25,
}) {
  const containerRef = useRef(null)
  const propsRef = useRef({})
  const [reducedMotion, setReducedMotion] = useState(false)
  propsRef.current = { colors, count, speed, amplitude, waviness, thickness, glow, taper, spread, intensity, saturation, opacity, scale }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || reducedMotion) return undefined
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 }, uResolution: { value: [1, 1] }, uColors: { value: palette(colors) },
        uColorCount: { value: Math.min(colors.length, MAX_COLORS) }, uStrandCount: { value: Math.min(count, MAX_STRANDS) },
        uSpeed: { value: speed }, uAmplitude: { value: amplitude }, uWaviness: { value: waviness }, uThickness: { value: thickness },
        uGlow: { value: glow }, uTaper: { value: taper }, uSpread: { value: spread }, uIntensity: { value: intensity },
        uOpacity: { value: opacity }, uScale: { value: scale }, uSaturation: { value: saturation },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })
    container.appendChild(gl.canvas)
    const resize = () => {
      const width = container.offsetWidth
      const height = container.offsetHeight
      renderer.setSize(width, height)
      program.uniforms.uResolution.value = [width, height]
    }
    resize()
    window.addEventListener('resize', resize)
    let frame = 0
    const render = (time) => {
      const current = propsRef.current
      frame = requestAnimationFrame(render)
      program.uniforms.uTime.value = time * 0.001
      program.uniforms.uColors.value = palette(current.colors)
      program.uniforms.uColorCount.value = Math.min(current.colors.length, MAX_COLORS)
      program.uniforms.uStrandCount.value = Math.min(Math.max(Math.round(current.count), 1), MAX_STRANDS)
      program.uniforms.uSpeed.value = current.speed
      program.uniforms.uAmplitude.value = current.amplitude
      program.uniforms.uWaviness.value = current.waviness
      program.uniforms.uThickness.value = current.thickness
      program.uniforms.uGlow.value = current.glow
      program.uniforms.uTaper.value = current.taper
      program.uniforms.uSpread.value = current.spread
      program.uniforms.uIntensity.value = current.intensity
      program.uniforms.uOpacity.value = current.opacity
      program.uniforms.uScale.value = current.scale
      program.uniforms.uSaturation.value = current.saturation
      renderer.render({ scene: mesh })
    }
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [reducedMotion])

  return (
    <div ref={containerRef} className="strands-container" aria-hidden="true">
      {reducedMotion && <div className="strands-static" />}
    </div>
  )
}
