import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { useWorld } from '../state';

/**
 * Screen-space finish for the surface: ambient occlusion grounds objects,
 * bloom lifts emissive screens and the sun, AgX tone mapping holds saturated
 * Mars oranges, then anti-aliasing and a light vignette. Low quality renders
 * without the composer and relies on the renderer's own tone mapping.
 */
export function PostProcessing() {
  const quality = useWorld((state) => state.quality);
  const { scene, camera, size } = useThree();
  const ao = useMemo(
    () => new N8AOPostPass(scene, camera, size.width, size.height),
    // Size is managed by the composer after construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, camera],
  );
  useEffect(() => {
    ao.configuration.aoRadius = 1.6;
    ao.configuration.distanceFalloff = 0.9;
    ao.configuration.intensity = 2.6;
    ao.configuration.screenSpaceRadius = false;
    ao.configuration.halfRes = true;
    ao.setQualityMode('Medium');
    return () => ao.dispose?.();
  }, [ao]);
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <primitive object={ao} />
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.15} intensity={0.55} />
      <ChromaticAberration offset={[0.00045, 0.00045]} radialModulation modulationOffset={0.55} />
      <Vignette eskil={false} offset={0.22} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
  );
}
