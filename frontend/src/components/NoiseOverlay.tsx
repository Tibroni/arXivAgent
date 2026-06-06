export default function NoiseOverlay() {
  return (
    <svg className="fixed inset-0 pointer-events-none z-[90] opacity-[0.03] mix-blend-overlay w-full h-full">
      <filter id="noiseFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
    </svg>
  );
}
