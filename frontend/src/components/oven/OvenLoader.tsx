import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion } from 'framer-motion';

interface OvenLoaderProps {
  stage: string;
  label: string;
}

// Flame particle data
const FLAMES = [
  { x: 52, delay: 0 },
  { x: 64, delay: 0.15 },
  { x: 76, delay: 0.3 },
  { x: 88, delay: 0.1 },
  { x: 100, delay: 0.25 },
];

export function OvenLoader({ stage, label }: OvenLoaderProps) {
  const pizzaRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGRadialGradientElement>(null);
  const panRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!pizzaRef.current || !panRef.current) return;

    const ctx = gsap.context(() => {
      // Pizza slide-in from left
      gsap.fromTo(
        panRef.current,
        { x: -80, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.1 },
      );

      // Pizza slow rotation loop
      gsap.to(pizzaRef.current, {
        rotation: 360,
        transformOrigin: '50% 50%',
        duration: 6,
        repeat: -1,
        ease: 'none',
      });

      // Glow pulse
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          attr: { r: '60%' },
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="oven-container">
      <svg
        width="180"
        height="140"
        viewBox="0 0 180 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Pizza oven loading animation"
      >
        <defs>
          {/* Heat glow gradient */}
          <radialGradient id="heatGlow" cx="50%" cy="80%" r="50%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
          </radialGradient>
          {/* Stone texture gradient */}
          <linearGradient id="stoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A2438" />
            <stop offset="100%" stopColor="#1A1525" />
          </linearGradient>
          {/* Pizza gradient */}
          <radialGradient id="pizzaGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFA94D" />
            <stop offset="40%" stopColor="#E8773A" />
            <stop offset="100%" stopColor="#C45C22" />
          </radialGradient>
          {/* Ember glow */}
          <radialGradient id="emberGlow" cx="50%" cy="100%" r="50%" ref={glowRef}>
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FF3D00" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Oven body — stone arch */}
        <ellipse cx="90" cy="75" rx="75" ry="60" fill="url(#stoneGrad)" />
        <ellipse cx="90" cy="75" rx="65" ry="52" fill="#120F1C" />

        {/* Inner oven glow */}
        <ellipse cx="90" cy="90" rx="50" ry="35" fill="url(#heatGlow)" />
        <ellipse cx="90" cy="90" rx="45" ry="30" fill="url(#emberGlow)" opacity="0.7" />

        {/* Oven floor */}
        <ellipse cx="90" cy="110" rx="58" ry="8" fill="#2A1F10" />

        {/* Stone arch details */}
        <path
          d="M 20 75 Q 20 20 90 20 Q 160 20 160 75"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 28 80 Q 28 30 90 30 Q 152 30 152 80"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
          fill="none"
        />

        {/* Pizza pan + pizza */}
        <g ref={panRef}>
          {/* Pan */}
          <ellipse cx="90" cy="108" rx="44" ry="6" fill="#3D2B0A" />
          <ellipse cx="90" cy="106" rx="44" ry="5" fill="#5C3F10" />

          {/* Pizza base */}
          <g ref={pizzaRef} style={{ transformBox: 'fill-box' }}>
            <ellipse cx="90" cy="102" rx="36" ry="6" fill="url(#pizzaGrad)" />
            {/* Cheese bubbles */}
            <ellipse cx="85" cy="100" rx="8" ry="3" fill="#FFD166" opacity="0.7" />
            <ellipse cx="100" cy="101" rx="6" ry="2.5" fill="#FFD166" opacity="0.6" />
            <ellipse cx="77" cy="101" rx="5" ry="2" fill="#FFD166" opacity="0.5" />
            {/* Pepperoni */}
            <ellipse cx="90" cy="100" rx="4" ry="2" fill="#C0392B" opacity="0.8" />
            <ellipse cx="80" cy="103" rx="3" ry="1.5" fill="#C0392B" opacity="0.7" />
            <ellipse cx="99" cy="103" rx="3" ry="1.5" fill="#C0392B" opacity="0.7" />
          </g>
        </g>

        {/* Flames */}
        {FLAMES.map((f, i) => (
          <motion.ellipse
            key={i}
            cx={f.x}
            cy={95}
            rx={3}
            ry={6}
            fill="#FF6B35"
            opacity={0.7}
            animate={{
              ry: [5, 9, 5],
              cy: [95, 89, 95],
              opacity: [0.5, 0.9, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: f.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Top heat haze */}
        <motion.ellipse
          cx="90"
          cy="40"
          rx="30"
          ry="5"
          fill="rgba(255,107,53,0.08)"
          animate={{ ry: [4, 8, 4], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>

      {/* Stage label */}
      <p className="font-mono-label" style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 11 }}>
        {label || 'Thinking…'}
      </p>
    </div>
  );
}
