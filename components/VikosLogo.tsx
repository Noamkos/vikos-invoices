// הלוגו של ויקוס — בנוי מ-HTML+CSS (לא SVG עם טקסט, שנשבר בדפים בעברית):
// VIKOS בכתב נטוי כבד, ה-i הוא פס כתום מוטה, והסלוגן מתחת.
// הגודל נשלט דרך font-size של ההורה (className, למשל text-[40px]) — הכול נמדד ב-em.

type Props = { className?: string; withTagline?: boolean; light?: boolean };

export default function VikosLogo({
  className = "",
  withTagline = true,
  light = false,
}: Props) {
  return (
    <span
      dir="ltr"
      role="img"
      aria-label="VIKOS — Your home. Our mission."
      className={"inline-flex select-none flex-col items-start leading-none " + className}
    >
      <span
        className={
          "flex items-baseline font-black italic tracking-[-0.04em] " +
          (light ? "text-white" : "text-[#1d1d1f]")
        }
        style={{ fontFamily: "'Arial Black', 'Segoe UI', Arial, sans-serif" }}
      >
        <span>V</span>
        <span
          aria-hidden
          className="relative mx-[0.07em] inline-block h-[0.52em] w-[0.14em] -skew-x-[14deg] bg-[#e0a339]"
        >
          <span className="absolute right-0 top-[-0.24em] block h-[0.15em] w-full bg-[#e0a339]" />
        </span>
        <span>KOS</span>
      </span>
      {withTagline && (
        <span
          className="mt-[0.16em] text-[0.24em] font-bold tracking-[0.02em] text-[#e0a339]"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          Your home. Our mission.
        </span>
      )}
    </span>
  );
}
