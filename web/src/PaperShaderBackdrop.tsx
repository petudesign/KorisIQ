import { lazy, Suspense } from "react";

const Dithering = lazy(() => import("@paper-design/shaders-react").then(({ Dithering: PaperDithering }) => ({ default: PaperDithering })));

export function PaperLeaderShader({ colorFront = "#6B49DE33" }: { colorFront?: string }) {
  return (
    <Suspense fallback={null}>
      <Dithering
        speed={0.5}
        shape="warp"
        type="4x4"
        size={2}
        scale={0.6}
        frame={714142.6489989847}
        colorBack="#00000000"
        colorFront={colorFront}
        minPixelRatio={1}
        maxPixelCount={160_000}
        style={{
          backgroundColor: "#000000",
          height: "155px",
          left: "-353px",
          position: "absolute",
          top: "-3px",
          width: "995px",
        }}
      />
    </Suspense>
  );
}
