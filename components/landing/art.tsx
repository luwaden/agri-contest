import type { MediaSlot } from "@/config/media";

/** Original vector artwork (no third-party assets). Colours come from the brand palette. */

function Maize({ x, y, h, d = 0, dir = 1, tone = "#3f9a5b", dur = 6.5 }: { x: number; y: number; h: number; d?: number; dir?: 1 | -1; tone?: string; dur?: number }) {
  const leaves = [0.25, 0.42, 0.6, 0.78].map((f, i) => {
    const s = i % 2 ? -dir : dir, yy = -h * f;
    return <path key={i} d={`M0 ${yy} Q ${s * 34} ${yy - 22} ${s * 66} ${yy + 12}`} stroke={tone} strokeWidth="5" strokeLinecap="round" fill="none" />;
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sway" style={{ animationDelay: `${-d}s`, animationDuration: `${dur}s` }}>
        <line x1="0" y1="0" x2="0" y2={-h} stroke={tone} strokeWidth="5" strokeLinecap="round" />
        {leaves}
        <ellipse cx={dir * 9} cy={-h * 0.52} rx="6" ry="16" fill="#e9c46a" transform={`rotate(${dir * 12} ${dir * 9} ${-h * 0.52})`} />
        <path d={`M0 ${-h} l-7 -16 M0 ${-h} l0 -20 M0 ${-h} l7 -16`} stroke="#e9c46a" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}


function RiceClump({ x, y, h, d = 0, dur = 5.5 }: { x: number; y: number; h: number; d?: number; dur?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sway" style={{ animationDelay: `${-d}s`, animationDuration: `${dur}s` }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const sd = i % 2 ? -1 : 1, tx = sd * (10 + i * 7), ty = -h * (0.86 + (i % 3) * 0.07);
          return (
            <g key={i}>
              <path d={`M${sd * i * 2} 0 Q ${sd * 4} ${-h * 0.6} ${tx} ${ty}`} stroke="#4aa367" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              {[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx={tx + sd * k * 2.6} cy={ty + 3 + k * 6} rx="3" ry="6.5" fill="#e9c46a" transform={`rotate(${sd * -14} ${tx + sd * k * 2.6} ${ty + 3 + k * 6})`} />)}
            </g>
          );
        })}
      </g>
    </g>
  );
}

function SoyBush({ x, y, d = 0, dur = 5 }: { x: number; y: number; d?: number; dur?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sway" style={{ animationDelay: `${-d}s`, animationDuration: `${dur}s` }}>
        <line x1="0" y1="0" x2="0" y2="-78" stroke="#3a8f55" strokeWidth="4" strokeLinecap="round" />
        {[[-18, -22, -32], [18, -32, 32], [-20, -50, -30], [20, -62, 30], [0, -80, 0]].map(([dx, dy, r], i) => (
          <ellipse key={i} cx={dx} cy={dy} rx="17" ry="8" fill={i % 2 ? "#55a86d" : "#4aa367"} transform={`rotate(${r} ${dx} ${dy})`} />
        ))}
        <g fill="#b9dfc1">{[[-6, -40], [7, -46], [-4, -58]].map(([px, py], i) => <ellipse key={i} cx={px} cy={py} rx="3" ry="8" transform={`rotate(${i * 12 - 10} ${px} ${py})`} />)}</g>
      </g>
    </g>
  );
}

/** Full-width landscape used behind the hero and closing CTA. */
export function FieldScene({ className = "", variant = "dusk" }: { className?: string; variant?: "dusk" | "day" }) {
  const rows = Array.from({ length: 19 }, (_, i) => i - 9);
  const day = variant === "day";
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`sun-${variant}`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#f4d27a" stopOpacity=".55" /><stop offset="1" stopColor="#f4d27a" stopOpacity="0" /></radialGradient>
      </defs>
      <g className="breathe"><circle cx="1090" cy="178" r="150" fill={`url(#sun-${variant})`} /></g>
      <circle cx="1090" cy="178" r="44" fill="#f2cf72" opacity={day ? 1 : 0.92} />
      <path d="M0 250 C 220 190 380 240 560 210 S 900 170 1100 215 S 1360 230 1440 200 V420 H0Z" fill={day ? "#2a7a46" : "#12391f"} className="drift" />
      <path d="M0 290 C 260 250 470 300 700 270 S 1120 240 1440 285 V420 H0Z" fill={day ? "#1f7039" : "#164a2a"} />
      <g>
        <path d="M0 320 C 300 300 640 335 940 312 S 1290 300 1440 318 V420 H0Z" fill={day ? "#195a2f" : "#1b5c33"} />
        {rows.map((i) => <line key={i} x1={720 + i * 26} y1="318" x2={720 + i * 150} y2="420" stroke="#55a86d" strokeOpacity=".28" strokeWidth="2" />)}
      </g>
      <path d="M0 368 C 320 350 700 380 1010 362 S 1330 358 1440 366 V420 H0Z" fill={day ? "#154927" : "#0e3319"} />
      <SoyBush x={250} y={424} d={0.4} dur={4.8} />
      <SoyBush x={620} y={428} d={2.1} dur={5.4} />
      <SoyBush x={830} y={428} d={1.1} dur={5.1} />
      <SoyBush x={1080} y={426} d={2.6} dur={4.9} />
      <RiceClump x={150} y={426} h={120} d={0.9} dur={5.2} />
      <RiceClump x={470} y={428} h={105} d={1.9} dur={5.8} />
      <RiceClump x={950} y={428} h={112} d={0.2} dur={5.4} />
      <RiceClump x={1230} y={426} h={125} d={1.4} dur={5.0} />
      <Maize x={70} y={420} h={190} d={0} dur={6.4} />
      <Maize x={190} y={424} h={150} d={1.2} dir={-1} tone="#2f8a4d" dur={7} />
      <Maize x={340} y={422} h={210} d={2.4} dur={6.1} />
      <Maize x={1010} y={424} h={170} d={1.8} dir={-1} tone="#2f8a4d" dur={6.8} />
      <Maize x={1150} y={420} h={225} d={0.7} dur={6.3} />
      <Maize x={1290} y={424} h={160} d={3} dir={-1} tone="#2f8a4d" dur={7.2} />
      <Maize x={1400} y={420} h={200} d={1.6} dur={6.6} />
    </svg>
  );
}

/** Topographic line pattern for the focal-state tiles. */
export function Contours({ seed = 0, className = "" }: { seed?: number; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="#8ac79a" strokeOpacity=".28" strokeWidth="1.4" transform={`rotate(${seed * 23} 200 150)`}>
        {Array.from({ length: 11 }, (_, i) => <ellipse key={i} cx={210 + seed * 12} cy={140 - seed * 6} rx={26 + i * 24} ry={16 + i * 15} transform={`rotate(${-18 + i * 3} 210 140)`} />)}
      </g>
      <circle cx={210 + seed * 12} cy={140 - seed * 6} r="5" fill="#e9c46a" />
    </svg>
  );
}

type CropProps = { className?: string };
const frame = (children: React.ReactNode, cls?: string) => (
  <svg viewBox="0 0 240 240" className={cls} aria-hidden="true" focusable="false">{children}</svg>
);

export function MaizeArt({ className }: CropProps) {
  return frame(<g><circle cx="120" cy="120" r="96" fill="#f6ecc9" opacity=".55" />
    <g className="sway" style={{ animationDuration: "6s" }}>
    <path d="M120 228 V70" stroke="#2f8a4d" strokeWidth="7" strokeLinecap="round" />
    <path d="M120 200 Q 62 176 40 208 M120 168 Q 178 140 204 176 M120 136 Q 66 112 46 146" stroke="#2f8a4d" strokeWidth="8" strokeLinecap="round" fill="none" />
    <ellipse cx="136" cy="110" rx="17" ry="42" fill="#e9c46a" transform="rotate(10 136 110)" />
    <path d="M124 76 Q 136 66 150 84 M122 92 Q 136 84 152 100" stroke="#c9a13c" strokeWidth="3" fill="none" />
    <path d="M120 70 l-16 -30 M120 70 v-36 M120 70 l16 -30" stroke="#c9a13c" strokeWidth="4" strokeLinecap="round" /></g></g>, className);
}
export function RiceArt({ className }: CropProps) {
  const stalks: Array<[string, number, number, number, number, number]> = [["M70 230 Q 74 120 108 60", 108, 60, -1, 0, 5.2], ["M120 230 Q 122 110 150 40", 150, 40, 1, 1.4, 6], ["M170 230 Q 166 130 192 76", 192, 76, 1, 0.7, 5.6]];
  return frame(<g><circle cx="120" cy="120" r="96" fill="#dcefe0" opacity=".7" />
    {stalks.map(([d, x, y, sd, delay, dur], k) => (
      <g key={k} className="sway" style={{ animationDelay: `${-delay}s`, animationDuration: `${dur}s` }}>
        <path d={d} stroke="#2f8a4d" strokeWidth="5" fill="none" strokeLinecap="round" />
        {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={x + sd * (6 + i * 3)} cy={y + 8 + i * 13} rx="4" ry="9" fill="#e9c46a" transform={`rotate(${sd * (-18 - i * 3)} ${x + sd * (6 + i * 3)} ${y + 8 + i * 13})`} />)}
      </g>))}</g>, className);
}
export function SoybeanArt({ className }: CropProps) {
  return frame(<g><circle cx="120" cy="120" r="96" fill="#e6efd4" opacity=".75" />
    <g className="sway" style={{ animationDuration: "5.4s" }}>
    <path d="M120 226 V120" stroke="#2f8a4d" strokeWidth="6" strokeLinecap="round" />
    <path d="M120 150 Q 70 120 50 150 Q 84 176 120 150 M120 150 Q 170 120 190 150 Q 156 176 120 150 M120 116 Q 84 76 56 96 Q 82 132 120 116 M120 116 Q 156 76 184 96 Q 158 132 120 116" fill="#55a86d" stroke="#2f8a4d" strokeWidth="2" />
    <g fill="#b9dfc1" stroke="#2f8a4d" strokeWidth="2.5"><path d="M92 70 q 10 -30 30 -38 q 4 30 -10 46 z" /><path d="M138 62 q 16 -26 38 -28 q 0 32 -18 44 z" /></g>
    <g fill="#2f8a4d" opacity=".55"><circle cx="106" cy="52" r="3" /><circle cx="114" cy="62" r="3" /><circle cx="152" cy="50" r="3" /><circle cx="160" cy="60" r="3" /></g></g></g>, className);
}
export function AlliedArt({ className }: CropProps) {
  const heads: Array<[number, number, number, number]> = [[64, 96, 0.2, 5.5], [176, 88, 1.3, 6.2]];
  return frame(<g><circle cx="120" cy="120" r="96" fill="#f3e3c8" opacity=".7" />
    {heads.map(([x, y, delay, dur], k) => (
      <g key={k} className="sway" style={{ animationDelay: `${-delay}s`, animationDuration: `${dur}s` }}>
        <line x1={x} y1="176" x2={x} y2={y} stroke="#8a6d1f" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx={x} cy={y - 14} rx="9" ry="20" fill="#c9793a" /><path d={`M${x} ${y + 30} q ${k ? 24 : -24} -6 ${k ? 34 : -34} 16`} stroke="#4aa367" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>))}
    <path d="M60 172 q 0 -70 60 -70 q 60 0 60 70 z" fill="#c9a13c" /><path d="M60 172 h120 v20 q -60 20 -120 0z" fill="#a9832a" />
    <path d="M108 102 q 12 -14 24 0" stroke="#7a5b16" strokeWidth="5" fill="none" strokeLinecap="round" />
    <g className="sway" style={{ animationDuration: "4.6s" }}><path d="M120 82 c-4 -26 16 -40 34 -38 c 2 22 -10 38 -34 38z" fill="#55a86d" stroke="#2f8a4d" strokeWidth="2" /><path d="M120 82 c 6 -12 14 -22 26 -30" stroke="#2f8a4d" strokeWidth="2" fill="none" /></g></g>, className);
}

/** Renders a real photo when the slot has one; otherwise the supplied illustration. */
export function Photo({ slot, fallback, className = "" }: { slot: MediaSlot; fallback: React.ReactNode; className?: string }) {
  if (!slot.src) return <div className={className}>{fallback}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={slot.src} alt={slot.alt} loading="lazy" className={`${className} object-cover`} />;
}
