// הלוגו של ויקוס — שחזור וקטורי (SVG) של הלוגו: VIKOS בשחור עם ה-i בכתום,
// והסלוגן "Your home. Our mission." מתחת. וקטורי = חד בכל גודל.

type Props = { className?: string; withTagline?: boolean };

const INK = "#1d1d1f";
const ORANGE = "#e0a339";

export default function VikosLogo({ className, withTagline = true }: Props) {
  return (
    <svg
      viewBox="0 0 240 92"
      className={className}
      role="img"
      aria-label="VIKOS — Your home. Our mission."
    >
      <g
        style={{
          fontFamily: "Arial Black, Arial, sans-serif",
          fontWeight: 900,
          fontStyle: "italic",
        }}
      >
        <text x="2" y="58" fontSize="56" fill={INK} letterSpacing="-2">
          V
        </text>
        {/* ה-i הכתום המוטה — הסימן המזהה של הלוגו */}
        <g transform="translate(52 14) skewX(-14)">
          <rect x="0" y="14" width="11" height="30" fill={ORANGE} />
          <rect x="1" y="0" width="11" height="10" fill={ORANGE} />
        </g>
        <text x="70" y="58" fontSize="56" fill={INK} letterSpacing="-2">
          KOS
        </text>
      </g>
      {withTagline && (
        <text
          x="4"
          y="82"
          fontSize="15"
          fill={ORANGE}
          style={{ fontFamily: "Arial, sans-serif", fontWeight: 700 }}
        >
          Your home. Our mission.
        </text>
      )}
    </svg>
  );
}
