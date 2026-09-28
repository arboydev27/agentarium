import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { frameSummary } from './ambient';

// Opt in with ?renderStats=1. Samples are local and never sent to the bridge.
export function RenderStats() {
  const gl = useThree((s) => s.gl);
  const node = useRef<HTMLOutputElement | null>(null);
  const samples = useRef<number[]>([]);
  const elapsed = useRef(0);
  useEffect(() => {
    const output = document.createElement('output');
    output.setAttribute('aria-label', 'Rendering diagnostics');
    output.setAttribute('aria-live', 'off');
    output.style.cssText =
      'position:absolute;top:8px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px);z-index:5;background:#18382ddd;color:#fff;padding:8px;border-radius:6px;font:11px monospace;pointer-events:none';
    gl.domElement.parentElement?.appendChild(output);
    node.current = output;
    return () => {
      output.remove();
      node.current = null;
    };
  }, [gl]);
  useFrame((_, delta) => {
    // Discard tab-resume gaps; intervals include browser scheduling, not just GPU work.
    if (delta <= 0 || delta > 0.25 || document.hidden) return;
    samples.current.push(delta * 1000);
    if (samples.current.length > 120) samples.current.shift();
    elapsed.current += delta;
    if (elapsed.current < 1 || !node.current) return;
    elapsed.current = 0;
    const { fps, p95 } = frameSummary(samples.current);
    node.current.textContent = `${fps.toFixed(0)} fps · p95 ${p95.toFixed(1)} ms · ${gl.info.render.calls} draws · ${gl.info.render.triangles.toLocaleString()} triangles · ${gl.info.memory.geometries} geometries · ${gl.info.memory.textures} textures`;
  });
  return null;
}
