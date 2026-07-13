import { useEffect, useRef, useState } from "react";
import { useLibrary } from "../store/library";
import { motion, AnimatePresence } from "framer-motion";

/** How long each backdrop is shown before crossfading to the next (ms). */
const SLIDE_DURATION = 9000;

/**
 * Animated, GPU-rendered gradient/aurora background using a lightweight WebGL
 * fragment shader. No heavy deps — raw WebGL. Falls back gracefully if WebGL
 * is unavailable.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

// hash & value noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;
  float n = fbm(p * 2.2 + vec2(t, -t*0.7));
  float n2 = fbm(p * 3.5 - vec2(t*0.6, t));

  vec3 c1 = vec3(0.0, 0.0, 0.0);        // pure OLED black base
  vec3 c2 = vec3(0.35, 0.15, 0.75);     // violet (softened)
  vec3 c3 = vec3(0.75, 0.25, 0.45);     // pink (softened)
  vec3 c4 = vec3(0.1, 0.6, 0.7);        // cyan (softened)

  vec3 col = c1;
  col = mix(col, c2, smoothstep(0.35, 0.9, n) * 0.45);
  col = mix(col, c3, smoothstep(0.5, 1.0, n2) * 0.3);
  col = mix(col, c4, smoothstep(0.75, 1.0, n * n2) * 0.2);

  // vignette
  float d = distance(uv, vec2(0.5));
  col *= smoothstep(1.15, 0.25, d);

  // subtle grain
  col += (hash(uv * u_time) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export default function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeBackdrops = useLibrary((s) => s.activeBackdrops);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Downscale canvas resolution by 4x. Since this is a heavily blurred and dark
      // background aurora, a lower rendering resolution looks identical but saves 16x pixels.
      canvas.width = Math.max(32, Math.floor((window.innerWidth * dpr) / 4));
      canvas.height = Math.max(32, Math.floor((window.innerHeight * dpr) / 4));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let lastTime = 0;
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      // Throttle to ~30 FPS (approx 33.3ms per frame) to prevent battery drain and high CPU/GPU usage
      if (now - lastTime < 33.3) return;
      lastTime = now;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Reset to the first slide whenever the backdrop set changes (new anime).
  useEffect(() => {
    setSlide(0);
  }, [activeBackdrops]);

  // Advance the slideshow on a timer and preload the upcoming image so the
  // crossfade never pops. No-op for 0 or 1 images.
  useEffect(() => {
    if (activeBackdrops.length <= 1) return;
    const next = (slide + 1) % activeBackdrops.length;
    // Preload the next frame.
    const img = new Image();
    img.src = activeBackdrops[next];
    const t = setTimeout(() => setSlide(next), SLIDE_DURATION);
    return () => clearTimeout(t);
  }, [slide, activeBackdrops]);

  const currentBackdrop = activeBackdrops[slide] ?? null;

  return (
    <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden bg-black">
      {/* WebGL Canvas Background */}
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full opacity-55"
        aria-hidden
      />

      {/* Dynamic anime backdrop — high-res TMDB artwork, crossfading slideshow.
          `key` is the URL so AnimatePresence crossfades between slides. */}
      <AnimatePresence>
        {currentBackdrop && (
          <motion.div
            key={currentBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.72 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
            className="absolute inset-0 h-full w-full overflow-hidden"
          >
            {/* Zooming and panning background (Ken Burns effect) */}
            <motion.img
              initial={{ scale: 1.15, x: "-1%", y: "-1%" }}
              animate={{
                scale: [1.15, 1.05, 1.15],
                x: ["-1%", "1%", "-1%"],
                y: ["-1%", "1%", "-1%"]
              }}
              transition={{
                duration: 35,
                repeat: Infinity,
                ease: "linear"
              }}
              src={currentBackdrop}
              alt=""
              // Medium blur: artwork is clearly visible but text stays readable.
              className="h-full w-full object-cover blur-[2px] brightness-[0.5] saturate-[1.15]"
            />
            {/* Blends to black at base/edges so foreground content stays legible */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/60" />
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle, transparent 35%, #000000 95%)"
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none bg-black/10 mix-blend-overlay" />
    </div>
  );
}
