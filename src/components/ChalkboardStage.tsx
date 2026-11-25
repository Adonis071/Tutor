import React from 'react';
import { VisualRepresentation, BoardAnnotation } from '../types';

interface ChalkboardStageProps {
  representation: VisualRepresentation;
  highlightedElementId: string | null;
  onSelectElement: (idOrLabel: string) => void;
}

const CHALK_COLORS = {
  white: {
    stroke: '#FFFFFF',
    text: 'text-white',
    border: 'border-white/30',
    bg: 'bg-white/10',
    hex: '#FFFFFF',
  },
  yellow: {
    stroke: '#FDE047',
    text: 'text-[#FDE047]',
    border: 'border-[#FDE047]/40',
    bg: 'bg-[#FDE047]/15',
    hex: '#FDE047',
  },
  blue: {
    stroke: '#7DD3FC',
    text: 'text-[#7DD3FC]',
    border: 'border-[#7DD3FC]/40',
    bg: 'bg-[#7DD3FC]/15',
    hex: '#7DD3FC',
  },
  coral: {
    stroke: '#FB7185',
    text: 'text-[#FB7185]',
    border: 'border-[#FB7185]/45',
    bg: 'bg-[#FB7185]/15',
    hex: '#FB7185',
  },
};

function matchesHighlight(target: string | null, candidates: string[]): boolean {
  if (!target) return false;
  const normTarget = target.toLowerCase().trim();
  return candidates.some((c) => {
    const normC = c.toLowerCase().trim();
    return normC.includes(normTarget) || normTarget.includes(normC);
  });
}

/**
 * Verified Scientific Schematic: Solar Eclipse (Sun -> Moon -> Earth)
 * - Moon positioned strictly between Sun and Earth
 * - Shadows extend behind the Moon (away from the Sun) toward Earth
 * - Distinct Umbra (dark full-shadow cone) and Penumbra (partial shadow region)
 */
function SolarEclipseSchematic({
  highlightedElementId,
  onSelectElement,
}: {
  highlightedElementId: string | null;
  onSelectElement: (id: string) => void;
}) {
  const isSunHighlighted = matchesHighlight(highlightedElementId, ['sol', 'sun', 'fonte']);
  const isMoonHighlighted = matchesHighlight(highlightedElementId, ['lua', 'moon', 'bloqueador']);
  const isUmbraHighlighted = matchesHighlight(highlightedElementId, ['umbra', 'total']);
  const isPenumbraHighlighted = matchesHighlight(highlightedElementId, ['penumbra', 'parcial']);
  const isEarthHighlighted = matchesHighlight(highlightedElementId, ['terra', 'earth', 'observador']);

  return (
    <svg
      viewBox="0 0 860 400"
      className="w-full h-auto max-h-[420px] select-none"
      role="img"
      aria-label="Esquema óptico de um eclipse solar com o Sol à esquerda, a Lua no centro bloqueando a luz e projetando cones de umbra e penumbra sobre a Terra à direita."
    >
      <defs>
        <radialGradient id="sunGlowSolar" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="65%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#FACC15" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="umbraFillSolar" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#07120D" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#07120D" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="penumbraFillSolar" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FB7185" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FB7185" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Optical Axis Line */}
      <line
        x1="120"
        y1="200"
        x2="760"
        y2="200"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />

      {/* Penumbra Cone (Behind Moon -> Toward Earth, opposite to Sun) */}
      <g
        className="cursor-pointer transition-opacity"
        onClick={() => onSelectElement('penumbra')}
      >
        <polygon
          points="390,174 680,108 680,292 390,226"
          fill="url(#penumbraFillSolar)"
          stroke={isPenumbraHighlighted ? '#FB7185' : '#FB7185'}
          strokeWidth={isPenumbraHighlighted ? '3' : '1.5'}
          strokeDasharray="5 4"
        />
      </g>

      {/* Umbra Cone (Central dark cone behind Moon -> Converging onto Earth surface) */}
      <g
        className="cursor-pointer transition-opacity"
        onClick={() => onSelectElement('umbra')}
      >
        <polygon
          points="390,174 654,193 654,207 390,226"
          fill="url(#umbraFillSolar)"
          stroke={isUmbraHighlighted ? '#FDE047' : '#FFFFFF'}
          strokeWidth={isUmbraHighlighted ? '3' : '1.8'}
        />
      </g>

      {/* Solar Light Rays Tangents from Sun (x=115) to Moon (x=390) and extending to Earth (x=680) */}
      {/* Top-to-top ray (umbra upper boundary) */}
      <line
        x1="115"
        y1="115"
        x2="654"
        y2="193"
        stroke="#FDE047"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* Bottom-to-bottom ray (umbra lower boundary) */}
      <line
        x1="115"
        y1="285"
        x2="654"
        y2="207"
        stroke="#FDE047"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* Cross tangent rays (penumbra boundaries) */}
      <line
        x1="115"
        y1="285"
        x2="680"
        y2="108"
        stroke="#FDE047"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <line
        x1="115"
        y1="115"
        x2="680"
        y2="292"
        stroke="#FDE047"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />

      {/* Directional Arrows of Sunlight (Left to Right) */}
      <g stroke="#FDE047" strokeWidth="2" fill="none">
        <line x1="215" y1="155" x2="265" y2="155" />
        <polyline points="257,149 265,155 257,161" />
        <line x1="215" y1="245" x2="265" y2="245" />
        <polyline points="257,239 265,245 257,251" />
      </g>
      <text x="240" y="138" textAnchor="middle" fill="#FDE047" fontSize="14" fontWeight="600">
        Luz solar direta
      </text>

      {/* 1. SUN (Left: x=115, y=200, r=85) */}
      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('sol')}
      >
        <circle cx="115" cy="200" r="98" fill="url(#sunGlowSolar)" opacity="0.35" />
        <circle
          cx="115"
          cy="200"
          r="82"
          fill="#FDE047"
          stroke={isSunHighlighted ? '#FFFFFF' : '#FEF08A'}
          strokeWidth={isSunHighlighted ? '5' : '2.5'}
        />
        <text x="115" y="205" textAnchor="middle" fill="#163024" fontSize="22" fontWeight="700">
          SOL
        </text>
        <text x="115" y="315" textAnchor="middle" fill="#FDE047" fontSize="16" fontWeight="600">
          1. Fonte Luminosa
        </text>
      </g>

      {/* 2. MOON (Center: x=390, y=200, r=26 — strictly between Sun and Earth) */}
      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('lua')}
      >
        {/* Lunar orbit arc indicator */}
        <path
          d="M 390,75 A 290,145 0 0,0 390,325"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.25"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <circle
          cx="390"
          cy="200"
          r="26"
          fill="#CBD5E1"
          stroke={isMoonHighlighted ? '#FDE047' : '#FFFFFF'}
          strokeWidth={isMoonHighlighted ? '4' : '2'}
        />
        {/* Dark night side of Moon facing Earth */}
        <path d="M 390,174 A 26,26 0 0,1 390,226 Z" fill="#1E293B" />
        <text x="390" y="152" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="700">
          LUA (Lua Nova)
        </text>
        <text x="390" y="255" textAnchor="middle" fill="#FFFFFF" fontSize="15" fontWeight="500">
          2. Bloqueia a luz entre Sol e Terra
        </text>
      </g>

      {/* 3. EARTH (Right: x=710, y=200, r=68) */}
      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('terra')}
      >
        <circle
          cx="710"
          cy="200"
          r="68"
          fill="#0284C7"
          stroke={isEarthHighlighted ? '#FDE047' : '#7DD3FC'}
          strokeWidth={isEarthHighlighted ? '4' : '2.5'}
        />
        {/* Night side of Earth (away from Sun) */}
        <path d="M 710,132 A 68,68 0 0,1 710,268 Z" fill="#0F172A" opacity="0.65" />
        {/* Penumbra spot on Earth surface */}
        <ellipse cx="646" cy="200" rx="8" ry="52" fill="#FB7185" fillOpacity="0.45" />
        {/* Umbra spot on Earth surface (Total Eclipse zone) */}
        <ellipse
          cx="643"
          cy="200"
          rx="5"
          ry="11"
          fill="#050B08"
          stroke="#FDE047"
          strokeWidth="1.5"
        />
        <text x="710" y="205" textAnchor="middle" fill="#FFFFFF" fontSize="20" fontWeight="700">
          TERRA
        </text>
        <text x="710" y="300" textAnchor="middle" fill="#7DD3FC" fontSize="16" fontWeight="600">
          3. Recebe os cones de sombra
        </text>
      </g>

      {/* Callout Labels for Umbra and Penumbra behind the Moon */}
      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('umbra')}
      >
        <line x1="535" y1="200" x2="535" y2="82" stroke="#FDE047" strokeWidth="2" />
        <circle cx="535" cy="200" r="4" fill="#FDE047" />
        <rect
          x="430"
          y="36"
          width="210"
          height="46"
          rx="6"
          fill="#0F231A"
          stroke={isUmbraHighlighted ? '#FDE047' : '#FDE047'}
          strokeWidth={isUmbraHighlighted ? '2.5' : '1.5'}
        />
        <text x="535" y="56" textAnchor="middle" fill="#FDE047" fontSize="15" fontWeight="700">
          UMBRA (Sombra Total)
        </text>
        <text x="535" y="74" textAnchor="middle" fill="#FFFFFF" fontSize="13">
          Observador vê Eclipse Total
        </text>
      </g>

      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('penumbra')}
      >
        <line x1="565" y1="255" x2="565" y2="335" stroke="#FB7185" strokeWidth="2" />
        <circle cx="565" cy="255" r="4" fill="#FB7185" />
        <rect
          x="445"
          y="335"
          width="240"
          height="46"
          rx="6"
          fill="#0F231A"
          stroke="#FB7185"
          strokeWidth={isPenumbraHighlighted ? '2.5' : '1.5'}
        />
        <text x="565" y="355" textAnchor="middle" fill="#FB7185" fontSize="15" fontWeight="700">
          PENUMBRA (Sombra Parcial)
        </text>
        <text x="565" y="373" textAnchor="middle" fill="#FFFFFF" fontSize="13">
          Observador vê Eclipse Parcial
        </text>
      </g>

      {/* Out of scale note */}
      <text x="24" y="384" fill="#FFFFFF" fillOpacity="0.6" fontSize="13" fontStyle="italic">
        * Esquema geométrico fora de escala para visualização clara da umbra e da penumbra.
      </text>
    </svg>
  );
}

/**
 * Verified Scientific Schematic: Lunar Eclipse (Sun -> Earth -> Moon)
 * - Earth positioned strictly between Sun and Moon
 * - Earth's Umbra and Penumbra extend behind Earth (opposite to the Sun) enveloping the Moon
 */
function LunarEclipseSchematic({
  highlightedElementId,
  onSelectElement,
}: {
  highlightedElementId: string | null;
  onSelectElement: (id: string) => void;
}) {
  const isEarthHighlighted = matchesHighlight(highlightedElementId, ['terra', 'earth', 'bloqueador']);
  const isMoonHighlighted = matchesHighlight(highlightedElementId, ['lua', 'moon', 'cheia']);
  const isUmbraHighlighted = matchesHighlight(highlightedElementId, ['umbra', 'total']);
  const isPenumbraHighlighted = matchesHighlight(highlightedElementId, ['penumbra', 'parcial']);

  return (
    <svg
      viewBox="0 0 860 400"
      className="w-full h-auto max-h-[420px] select-none"
      role="img"
      aria-label="Esquema óptico de um eclipse lunar com o Sol à esquerda, a Terra no centro bloqueando a luz solar e a Lua à direita imersa no cone de umbra terrestre."
    >
      <defs>
        <linearGradient id="earthUmbraLunar" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#07120D" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#4C1D1D" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#07120D" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="earthPenumbraLunar" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Optical Axis */}
      <line
        x1="115"
        y1="200"
        x2="820"
        y2="200"
        stroke="#FFFFFF"
        strokeOpacity="0.2"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />

      {/* Penumbra Cone Behind Earth (x=410 to x=830) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('penumbra')}>
        <polygon
          points="410,138 825,65 825,335 410,262"
          fill="url(#earthPenumbraLunar)"
          stroke="#7DD3FC"
          strokeWidth={isPenumbraHighlighted ? '3' : '1.5'}
          strokeDasharray="5 4"
        />
      </g>

      {/* Umbra Cone Behind Earth (x=410 to x=830, enveloping the Moon at x=700) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('umbra')}>
        <polygon
          points="410,138 825,168 825,232 410,262"
          fill="url(#earthUmbraLunar)"
          stroke={isUmbraHighlighted ? '#FDE047' : '#FB7185'}
          strokeWidth={isUmbraHighlighted ? '3' : '1.8'}
        />
      </g>

      {/* Tangent Rays from Sun (x=110) to Earth (x=410) */}
      <line x1="110" y1="118" x2="825" y2="168" stroke="#FDE047" strokeOpacity="0.5" strokeWidth="1.5" />
      <line x1="110" y1="282" x2="825" y2="232" stroke="#FDE047" strokeOpacity="0.5" strokeWidth="1.5" />
      <line
        x1="110"
        y1="282"
        x2="825"
        y2="65"
        stroke="#FDE047"
        strokeOpacity="0.3"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <line
        x1="110"
        y1="118"
        x2="825"
        y2="335"
        stroke="#FDE047"
        strokeOpacity="0.3"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />

      {/* 1. SUN (Left: x=110, y=200) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('sol')}>
        <circle cx="110" cy="200" r="82" fill="#FDE047" stroke="#FEF08A" strokeWidth="2.5" />
        <text x="110" y="206" textAnchor="middle" fill="#163024" fontSize="22" fontWeight="700">
          SOL
        </text>
        <text x="110" y="314" textAnchor="middle" fill="#FDE047" fontSize="16" fontWeight="600">
          1. Fonte Luminosa
        </text>
      </g>

      {/* 2. EARTH (Center: x=410, y=200, r=62 — strictly between Sun and Moon) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('terra')}>
        <circle
          cx="410"
          cy="200"
          r="62"
          fill="#0284C7"
          stroke={isEarthHighlighted ? '#FDE047' : '#7DD3FC'}
          strokeWidth={isEarthHighlighted ? '4.5' : '2.5'}
        />
        <path d="M 410,138 A 62,62 0 0,1 410,262 Z" fill="#0F172A" opacity="0.7" />
        <text x="410" y="205" textAnchor="middle" fill="#FFFFFF" fontSize="19" fontWeight="700">
          TERRA
        </text>
        <text x="410" y="294" textAnchor="middle" fill="#7DD3FC" fontSize="16" fontWeight="700">
          2. Bloqueia a luz entre Sol e Lua
        </text>
      </g>

      {/* 3. MOON (Right: x=700, y=200, r=24 — inside Earth's Umbra) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('lua')}>
        <path
          d="M 700,75 A 280,150 0 0,1 700,325"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.25"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <circle
          cx="700"
          cy="200"
          r="24"
          fill="#FB7185"
          stroke={isMoonHighlighted ? '#FDE047' : '#FFFFFF'}
          strokeWidth={isMoonHighlighted ? '4' : '2'}
        />
        <text x="700" y="158" textAnchor="middle" fill="#FB7185" fontSize="18" fontWeight="700">
          LUA (Lua Cheia)
        </text>
        <text x="700" y="248" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="500">
          3. Imersa na Umbra da Terra
        </text>
      </g>

      {/* Umbra & Penumbra Labels */}
      <g className="cursor-pointer" onClick={() => onSelectElement('umbra')}>
        <line x1="570" y1="185" x2="570" y2="78" stroke="#FB7185" strokeWidth="2" />
        <circle cx="570" cy="185" r="4" fill="#FB7185" />
        <rect
          x="455"
          y="32"
          width="235"
          height="46"
          rx="6"
          fill="#0F231A"
          stroke="#FB7185"
          strokeWidth="1.8"
        />
        <text x="572" y="52" textAnchor="middle" fill="#FB7185" fontSize="15" fontWeight="700">
          UMBRA DA TERRA
        </text>
        <text x="572" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="13">
          Cone central onde ocorre o Eclipse Total
        </text>
      </g>

      <g className="cursor-pointer" onClick={() => onSelectElement('penumbra')}>
        <line x1="590" y1="278" x2="590" y2="335" stroke="#7DD3FC" strokeWidth="2" />
        <circle cx="590" cy="278" r="4" fill="#7DD3FC" />
        <rect
          x="470"
          y="335"
          width="245"
          height="46"
          rx="6"
          fill="#0F231A"
          stroke="#7DD3FC"
          strokeWidth="1.8"
        />
        <text x="592" y="355" textAnchor="middle" fill="#7DD3FC" fontSize="15" fontWeight="700">
          PENUMBRA DA TERRA
        </text>
        <text x="592" y="373" textAnchor="middle" fill="#FFFFFF" fontSize="13">
          Região externa de sombra parcial
        </text>
      </g>

      <text x="24" y="384" fill="#FFFFFF" fillOpacity="0.6" fontSize="13" fontStyle="italic">
        * Esquema geométrico fora de escala: a sombra se estende atrás da Terra, no sentido oposto ao Sol.
      </text>
    </svg>
  );
}

/**
 * Verified Scientific Schematic: Lunar Orbital Inclination (~5.14°) and Orbital Nodes
 */
function OrbitalInclinationSchematic({
  highlightedElementId,
  onSelectElement,
}: {
  highlightedElementId: string | null;
  onSelectElement: (id: string) => void;
}) {
  const isAngleHighlighted = matchesHighlight(highlightedElementId, ['inclinacao', '5', 'plano']);
  const isNodeHighlighted = matchesHighlight(highlightedElementId, ['nodo', 'cruzamento']);

  return (
    <svg
      viewBox="0 0 860 400"
      className="w-full h-auto max-h-[420px] select-none"
      role="img"
      aria-label="Esquema da inclinação orbital de 5,14 graus da Lua em relação ao plano da eclíptica, destacando os nodos orbitais e por que a sombra normalmente passa acima ou abaixo da Terra."
    >
      {/* Ecliptic Plane (Horizontal Reference Line Sun -> Earth) */}
      <line
        x1="60"
        y1="210"
        x2="800"
        y2="210"
        stroke="#FDE047"
        strokeWidth="2.5"
      />
      <text x="195" y="196" fill="#FDE047" fontSize="15" fontWeight="700">
        Plano da Eclíptica (Órbita Terra – Sol: 0°)
      </text>

      {/* Sun Direction Left */}
      <circle cx="70" cy="210" r="38" fill="#FDE047" />
      <text x="70" y="216" textAnchor="middle" fill="#163024" fontSize="16" fontWeight="700">
        SOL
      </text>

      {/* Tilted Lunar Orbital Plane (~5.14° exaggerated visually for clarity) */}
      <g
        className="cursor-pointer"
        onClick={() => onSelectElement('inclinacao')}
      >
        <line
          x1="280"
          y1="295"
          x2="790"
          y2="125"
          stroke="#7DD3FC"
          strokeWidth={isAngleHighlighted ? '4' : '2.5'}
          strokeDasharray="8 4"
        />
        <text
          x="655"
          y="112"
          textAnchor="middle"
          fill="#7DD3FC"
          fontSize="16"
          fontWeight="700"
        >
          Plano da Órbita Lunar (Inclinado ~5,14°)
        </text>
      </g>

      {/* Angle Arc around Earth (Center at x=535, y=210) */}
      <path
        d="M 645,210 A 110,110 0 0,0 639,175"
        fill="none"
        stroke="#FB7185"
        strokeWidth="3"
      />
      <text x="695" y="196" fill="#FB7185" fontSize="18" fontWeight="700">
        5,14°
      </text>

      {/* Earth at Orbital Center (x=535, y=210) */}
      <circle cx="535" cy="210" r="34" fill="#0284C7" stroke="#FFFFFF" strokeWidth="2.5" />
      <text x="535" y="215" textAnchor="middle" fill="#FFFFFF" fontSize="15" fontWeight="700">
        TERRA
      </text>

      {/* Orbital Node Marker at intersection (x=535, y=210 projected) */}
      <g className="cursor-pointer" onClick={() => onSelectElement('nodo')}>
        <circle
          cx="535"
          cy="210"
          r="8"
          fill="#FB7185"
          stroke="#FFFFFF"
          strokeWidth={isNodeHighlighted ? '4' : '2'}
        />
        <line x1="535" y1="210" x2="535" y2="335" stroke="#FB7185" strokeWidth="2" />
        <rect
          x="395"
          y="335"
          width="280"
          height="46"
          rx="6"
          fill="#0F231A"
          stroke="#FB7185"
          strokeWidth="1.8"
        />
        <text x="535" y="355" textAnchor="middle" fill="#FB7185" fontSize="15" fontWeight="700">
          LINHA DOS NODOS ORBITAIS
        </text>
        <text x="535" y="373" textAnchor="middle" fill="#FFFFFF" fontSize="13">
          Eclipses só ocorrem quando a Lua cruza este ponto
        </text>
      </g>

      {/* Moon Position 1: New Moon BELOW Ecliptic (x=345, y=273) -> Shadow misses Earth */}
      <g className="cursor-pointer" onClick={() => onSelectElement('sombra_perdida')}>
        <polygon
          points="345,259 495,268 495,278 345,287"
          fill="#07120D"
          fillOpacity="0.85"
          stroke="#FFFFFF"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <circle cx="345" cy="273" r="16" fill="#CBD5E1" stroke="#FFFFFF" strokeWidth="2" />
        <text x="345" y="315" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="600">
          Lua Nova fora do nodo:
        </text>
        <text x="345" y="333" textAnchor="middle" fill="#FDE047" fontSize="13">
          A sombra passa abaixo da Terra (Sem eclipse)
        </text>
      </g>

      {/* Moon Position 2: Full Moon ABOVE Ecliptic (x=725, y=147) -> Passes above Earth's shadow */}
      <g className="cursor-pointer" onClick={() => onSelectElement('sombra_perdida')}>
        {/* Earth's shadow cone along the ecliptic (y=210) */}
        <polygon
          points="569,185 785,198 785,222 569,235"
          fill="#07120D"
          fillOpacity="0.7"
          stroke="#FFFFFF"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <circle cx="725" cy="147" r="16" fill="#FDE047" stroke="#FFFFFF" strokeWidth="2" />
        <text x="725" y="72" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="600">
          Lua Cheia fora do nodo:
        </text>
        <text x="725" y="90" textAnchor="middle" fill="#7DD3FC" fontSize="13">
          Passa acima da umbra da Terra
        </text>
      </g>
    </svg>
  );
}

export const ChalkboardStage: React.FC<ChalkboardStageProps> = ({
  representation,
  highlightedElementId,
  onSelectElement,
}) => {
  const renderPrimaryVisual = () => {
    // 1. Check verified scientific diagram presets first
    if (representation.diagramPreset === 'solar_eclipse') {
      return (
        <SolarEclipseSchematic
          highlightedElementId={highlightedElementId}
          onSelectElement={onSelectElement}
        />
      );
    }

    if (representation.diagramPreset === 'lunar_eclipse') {
      return (
        <LunarEclipseSchematic
          highlightedElementId={highlightedElementId}
          onSelectElement={onSelectElement}
        />
      );
    }

    if (representation.diagramPreset === 'orbital_inclination') {
      return (
        <OrbitalInclinationSchematic
          highlightedElementId={highlightedElementId}
          onSelectElement={onSelectElement}
        />
      );
    }

    // 2. Quantitative Chart Representation
    if (
      representation.type === 'chart' &&
      representation.chartData &&
      representation.chartData.points.length > 0
    ) {
      const points = representation.chartData.points;
      const maxVal = Math.max(...points.map((p) => Math.abs(p.value)), 1);

      return (
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between text-xs font-mono text-white/70 mb-4">
            <span>Eixo Y: {representation.chartData.yAxisLabel}</span>
            <span>Eixo X: {representation.chartData.xAxisLabel}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {points.map((pt, idx) => {
              const colorObj =
                CHALK_COLORS[pt.color as keyof typeof CHALK_COLORS] || CHALK_COLORS.yellow;
              const pct = Math.min(100, Math.max(12, Math.round((Math.abs(pt.value) / maxVal) * 100)));
              const isHighlighted = matchesHighlight(highlightedElementId, [pt.label]);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectElement(pt.label)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'border-[#FDE047] bg-white/15 ring-2 ring-[#FDE047]'
                      : `${colorObj.border} bg-black/20 hover:bg-white/10`
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <span className={`font-semibold text-base ${colorObj.text}`}>{pt.label}</span>
                    <span className="font-mono text-xl font-bold text-white tabular-nums">
                      {pt.value} {pt.unit}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: colorObj.hex }}
                    />
                  </div>
                  {pt.note && <p className="text-sm text-white/80 leading-snug">{pt.note}</p>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // 3. Relationship Map (Non-sequential network of concepts)
    if (
      representation.type === 'relationship_map' &&
      representation.relationships &&
      Array.isArray(representation.relationships.nodes) &&
      representation.relationships.nodes.length > 0
    ) {
      const nodes = representation.relationships.nodes;
      const edges = representation.relationships.edges || [];
      return (
        <div className="p-4 sm:p-6 space-y-5">
          {representation.svgCode && representation.svgCode.includes('<svg') && (
            <div
              className="w-full overflow-x-auto rounded-xl bg-black/15 p-3 border border-white/10"
              dangerouslySetInnerHTML={{ __html: representation.svgCode }}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nodes.map((node) => {
              const colorObj =
                CHALK_COLORS[node.color as keyof typeof CHALK_COLORS] || CHALK_COLORS.blue;
              const isHighlighted = matchesHighlight(highlightedElementId, [node.id, node.label]);
              const relatedEdges = (edges || []).filter(
                (e) => e && (e.from === node.id || e.to === node.id || e.from === node.label)
              );

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectElement(node.label)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'border-[#FDE047] bg-white/15 ring-2 ring-[#FDE047]'
                      : `${colorObj.border} ${colorObj.bg} hover:bg-white/15`
                  }`}
                >
                  <div className={`text-lg font-bold mb-1 ${colorObj.text}`}>{node.label}</div>
                  <p className="text-sm text-white/90 leading-relaxed mb-3">{node.role}</p>
                  {relatedEdges.length > 0 && (
                    <div className="pt-2 border-t border-white/15 space-y-1">
                      {relatedEdges.map((edge, i) => (
                        <div key={i} className="text-xs font-mono text-[#FDE047]">
                          ↔ {edge.relationLabel}
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // 4. Custom SVG generated for the concept (coupled with Comparison or Process when applicable)
    return (
      <div className="space-y-5">
        {representation.svgCode && representation.svgCode.includes('<svg') && (
          <div
            className="w-full overflow-x-auto rounded-xl bg-black/20 p-3 sm:p-4 border border-white/15 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-[420px]"
            dangerouslySetInnerHTML={{ __html: representation.svgCode }}
          />
        )}

        {/* Side-by-Side Comparison View */}
        {representation.comparison && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
            {[representation.comparison.left, representation.comparison.right].map((side, idx) => {
              const colorObj =
                CHALK_COLORS[side.accentColor as keyof typeof CHALK_COLORS] ||
                (idx === 0 ? CHALK_COLORS.blue : CHALK_COLORS.yellow);
              const isHighlighted = matchesHighlight(highlightedElementId, [side.title]);

              return (
                <div
                  key={idx}
                  onClick={() => onSelectElement(side.title)}
                  className={`cursor-pointer p-5 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'border-[#FDE047] bg-white/15 ring-2 ring-[#FDE047]'
                      : `${colorObj.border} ${colorObj.bg}`
                  }`}
                >
                  <h4 className={`text-xl font-bold mb-1 ${colorObj.text}`}>{side.title}</h4>
                  <p className="text-sm text-white/80 mb-3">{side.subtitle}</p>
                  <ul className="space-y-2 text-base text-white/95">
                    {side.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`font-bold ${colorObj.text}`}>•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Process Mechanism Flow */}
        {representation.processSteps && representation.processSteps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
            {representation.processSteps.map((step, idx) => {
              const colorObj =
                CHALK_COLORS[step.color as keyof typeof CHALK_COLORS] || CHALK_COLORS.yellow;
              const isHighlighted = matchesHighlight(highlightedElementId, [
                step.id,
                step.title,
                step.stepLabel,
              ]);

              return (
                <button
                  key={step.id || idx}
                  type="button"
                  onClick={() => onSelectElement(step.title)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'border-[#FDE047] bg-white/15 ring-2 ring-[#FDE047]'
                      : `${colorObj.border} bg-black/25 hover:bg-white/10`
                  }`}
                >
                  <div className="text-xs font-mono uppercase tracking-wider text-white/70 mb-1">
                    {step.stepLabel}
                  </div>
                  <div className={`text-lg font-bold mb-1.5 ${colorObj.text}`}>{step.title}</div>
                  <p className="text-sm text-white/90 leading-relaxed">{step.description}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chalkboard-surface rounded-2xl border-[10px] border-[#4A3728] text-white p-5 sm:p-7 transition-all">
      {/* Chalkboard Header: Guiding Question & Title */}
      <div className="border-b border-white/15 pb-4 mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[#FDE047] mb-1">
            Pergunta do Quadro: {representation.guidingQuestion}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {representation.title}
          </h2>
          <p className="text-base text-white/80 mt-0.5">{representation.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-white/75 shrink-0">
          <span>
            Esquema:{' '}
            {representation.type === 'labeled_drawing'
              ? 'Desenho com Legendas'
              : representation.type === 'comparison'
              ? 'Comparação Direta'
              : representation.type === 'process'
              ? 'Mecanismo / Processo'
              : representation.type === 'chart'
              ? 'Gráfico Quantitativo'
              : 'Mapa de Relações'}
          </span>
        </div>
      </div>

      {/* Main Visual Diagram / SVG Canvas */}
      <div className="my-2">{renderPrimaryVisual()}</div>

      {/* Interactive Chalk Legend / Annotations */}
      {representation.annotations && representation.annotations.length > 0 && (
        <div className="mt-6 pt-5 border-t border-white/15">
          <div className="text-xs font-mono text-white/70 mb-3">
            LEGENDAS DO QUADRO (Clique em um elemento para destacar ou perguntar sobre ele):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {representation.annotations.map((ann: BoardAnnotation) => {
              const colorObj = CHALK_COLORS[ann.color] || CHALK_COLORS.white;
              const isSelected = matchesHighlight(highlightedElementId, [ann.id, ann.label]);

              return (
                <button
                  key={ann.id}
                  type="button"
                  onClick={() => onSelectElement(ann.label)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#FDE047] bg-white/20 ring-2 ring-[#FDE047]'
                      : `${colorObj.border} ${colorObj.bg} hover:bg-white/15`
                  }`}
                >
                  <div className={`font-bold text-base mb-1 ${colorObj.text}`}>{ann.label}</div>
                  <p className="text-sm text-white/90 leading-snug">{ann.detail}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chalkboard Takeaway Footer */}
      <div className="mt-6 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-base sm:text-lg font-medium text-[#7DD3FC]">
          <span className="font-bold text-[#FDE047]">Síntese no Quadro: </span>
          {representation.takeaway}
        </div>
        {representation.scaleDisclaimer && (
          <span className="text-xs font-mono text-white/60 shrink-0">
            {representation.scaleDisclaimer}
          </span>
        )}
      </div>
    </div>
  );
};
