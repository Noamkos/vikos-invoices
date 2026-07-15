// פס הניווט העליון — בסגנון אפל: כהה, שקוף למחצה עם טשטוש, דק ושקט.

import VikosLogo from "./VikosLogo";

type Props = { badge?: string | null; active?: "home" | "settings" };

export default function TopNav({ badge = null, active = "home" }: Props) {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#161617]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-3">
          <VikosLogo light withTagline={false} className="text-[19px]" />
          <span className="hidden h-4 w-px bg-white/20 sm:block" />
          <span className="text-[13px] font-medium text-white/90">
            מערכת החשבוניות של ויקי
          </span>
        </a>
        <div className="flex items-center gap-5 text-[12px]">
          {badge && (
            <span className="rounded-full bg-[#e0a339]/20 px-2.5 py-0.5 font-medium text-[#f0c473]">
              {badge}
            </span>
          )}
          <a
            href="/settings"
            className={
              "transition-colors duration-200 " +
              (active === "settings" ? "text-white" : "text-white/60 hover:text-white")
            }
          >
            רשימות
          </a>
        </div>
      </div>
    </nav>
  );
}
