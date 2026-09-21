import { useId } from "react";

export type CowMood = "senang" | "semangat" | "fokus" | "istirahat" | "tidur" | "ingat";

const INK = "#3a2618";

// Sapi kecil untuk teman belajar: satu wajah, enam suasana hati (topi, ikat kepala, rumput, topi tidur, lonceng, bintang).
export function CowBuddy({
  mood = "senang",
  size = 64,
  className = "",
  title,
}: {
  mood?: CowMood;
  size?: number;
  className?: string;
  title?: string;
}) {
  const clip = useId();
  const closed = mood === "tidur";
  const happyEyes = mood === "semangat";
  const wide = mood === "ingat";
  const half = mood === "istirahat";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <ellipse cx="50" cy="54" rx="33" ry="31" />
        </clipPath>
      </defs>

      {/* telinga */}
      <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
        <ellipse cx="17" cy="42" rx="12" ry="8" transform="rotate(-28 17 42)" fill="#2b1d14" />
        <ellipse cx="83" cy="42" rx="12" ry="8" transform="rotate(28 83 42)" fill="#fffdf6" />
      </g>
      <ellipse cx="17" cy="42" rx="6.5" ry="3.8" transform="rotate(-28 17 42)" fill="#f3a3b1" />
      <ellipse cx="83" cy="42" rx="6.5" ry="3.8" transform="rotate(28 83 42)" fill="#f3a3b1" />

      {/* tanduk kecil */}
      <g fill="#f2dba8" stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
        <path d="M31 27 Q26 15 34 13 Q36 21 39 26 Z" />
        <path d="M69 27 Q74 15 66 13 Q64 21 61 26 Z" />
      </g>

      {/* kepala dan bercak */}
      <ellipse cx="50" cy="54" rx="33" ry="31" fill="#fffdf6" />
      <g clipPath={`url(#${clip})`}>
        <path
          d="M14 30 C22 20 42 22 46 30 C46 37 38 41 30 42 C20 45 12 41 14 30 Z"
          fill="#2b1d14"
        />
        <ellipse cx="80" cy="76" rx="10" ry="7" fill="#2b1d14" />
      </g>
      <ellipse cx="50" cy="54" rx="33" ry="31" fill="none" stroke={INK} strokeWidth="3" />

      {/* mata */}
      {closed ? (
        <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round">
          <path d="M31 53 Q36 58 41 53" />
          <path d="M59 53 Q64 58 69 53" />
        </g>
      ) : happyEyes ? (
        <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d="M31 54 Q36 47 41 54" />
          <path d="M59 54 Q64 47 69 54" />
        </g>
      ) : half ? (
        <g stroke={INK} strokeWidth="2.8" strokeLinecap="round">
          <path d="M31 52 L41 52" />
          <path d="M59 52 L69 52" />
        </g>
      ) : (
        <g>
          <circle cx="36" cy="52" r={wide ? 5.8 : 4.6} fill="#2a1a10" />
          <circle cx="64" cy="52" r={wide ? 5.8 : 4.6} fill="#2a1a10" />
          <circle cx="37.6" cy="50.4" r="1.5" fill="#fff" />
          <circle cx="65.6" cy="50.4" r="1.5" fill="#fff" />
        </g>
      )}
      {mood === "fokus" && (
        <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round">
          <path d="M30 44 L42 47" />
          <path d="M70 44 L58 47" />
        </g>
      )}

      {/* pipi */}
      <ellipse cx="27" cy="64" rx="5.5" ry="3.4" fill="#f7b3bf" opacity="0.85" />
      <ellipse cx="73" cy="64" rx="5.5" ry="3.4" fill="#f7b3bf" opacity="0.85" />

      {/* moncong dan mulut */}
      <ellipse cx="50" cy="68" rx="17" ry="11.5" fill="#f6a8b6" stroke={INK} strokeWidth="2.6" />
      <ellipse cx="44" cy="68" rx="2.2" ry="3" fill="#a94e60" />
      <ellipse cx="56" cy="68" rx="2.2" ry="3" fill="#a94e60" />
      {mood === "semangat" ? (
        <path
          d="M43 77 Q50 87 57 77 Z"
          fill="#a94e60"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : mood === "tidur" ? (
        <path
          d="M46 78 Q50 80 54 78"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M43 77 Q50 83 57 77"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}

      {/* pelengkap sesuai suasana */}
      {(mood === "senang" || mood === "semangat") && (
        <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
          <ellipse cx="50" cy="26" rx="24" ry="6" fill="#f4a9bd" />
          <path d="M34 24 Q36 8 50 8 Q64 8 66 24 Z" fill="#f7bfd0" />
          <path d="M35 22 Q50 26 65 22 L65 18 Q50 22 35 18 Z" fill="#c74b78" stroke="none" />
        </g>
      )}
      {mood === "fokus" && (
        <g>
          <path
            d="M18 34 Q50 22 82 34 L80 42 Q50 30 20 42 Z"
            fill="#d94b4b"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="31" r="3.4" fill="#fffdf6" stroke={INK} strokeWidth="1.6" />
        </g>
      )}
      {mood === "istirahat" && (
        <g strokeLinecap="round">
          <path d="M55 80 Q70 86 80 72" fill="none" stroke="#5c8a2f" strokeWidth="3" />
          <path
            d="M80 72 Q86 64 90 68 Q86 74 80 72 Z"
            fill="#7cb342"
            stroke="#5c8a2f"
            strokeWidth="1.6"
          />
          <path d="M72 82 Q76 76 82 78" fill="none" stroke="#5c8a2f" strokeWidth="2.4" />
        </g>
      )}
      {mood === "tidur" && (
        <g>
          <path
            d="M22 26 Q50 -2 78 26 Q50 22 22 26 Z"
            fill="#8fb4e8"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="14" r="5" fill="#fffdf6" stroke={INK} strokeWidth="2" />
          <text
            x="78"
            y="44"
            fontSize="15"
            fontWeight="800"
            fill={INK}
            fontFamily="Nunito, sans-serif"
          >
            z
          </text>
          <text
            x="88"
            y="32"
            fontSize="11"
            fontWeight="800"
            fill={INK}
            fontFamily="Nunito, sans-serif"
          >
            z
          </text>
        </g>
      )}
      {mood === "ingat" && (
        <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M40 92 Q40 82 50 82 Q60 82 60 92 Z" fill="#f2c24b" />
          <circle cx="50" cy="95" r="2.6" fill="#f2c24b" />
          <path d="M84 20 Q90 24 90 30" fill="none" />
          <path d="M88 14 Q97 20 97 30" fill="none" />
          <path d="M14 20 Q8 24 8 30" fill="none" />
        </g>
      )}
      {mood === "semangat" && (
        <g fill="#f2c24b" stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
          <path
            d="M12 12 l2.4 5 5.4 .6 -4 3.7 1.2 5.3 -5 -2.8 -5 2.8 1.2 -5.3 -4 -3.7 5.4 -.6 z"
            transform="translate(2 2) scale(.9)"
          />
          <path
            d="M88 8 l2 4.2 4.6 .5 -3.4 3.1 1 4.5 -4.2 -2.4 -4.2 2.4 1 -4.5 -3.4 -3.1 4.6 -.5 z"
            transform="translate(-2 4)"
          />
        </g>
      )}
    </svg>
  );
}
