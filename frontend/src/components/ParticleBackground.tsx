import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "../contexts/ThemeContext";

export default function ParticleBackground() {
  const [init, setInit] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initParticlesEngine(async (engine: any) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  // Don't render particles in light mode — they look out of place
  // on a clean white/warm background and add visual noise
  if (!init || theme === 'light') return null;

  return (
    <Particles
      id="tsparticles"
      className="absolute inset-0 z-0 pointer-events-none"
      options={{
        fullScreen: { enable: false, zIndex: 0 },
        background: { color: { value: "transparent" } },
        fpsLimit: 60,
        particles: {
          color: { value: "#ffffff" },
          links: { enable: false },
          move: {
            direction: "none",
            enable: true,
            outModes: { default: "out" },
            random: true,
            speed: 0.2,
            straight: false,
          },
          number: { density: { enable: true, width: 800 }, value: 35 },
          opacity: { value: { min: 0.05, max: 0.2 } },
          shape: { type: "circle" },
          size: { value: { min: 1, max: 1.5 } },
        },
        detectRetina: true,
      }}
    />
  );
}