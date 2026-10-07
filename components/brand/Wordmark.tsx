/**
 * Typographic name of the programme. The contest has no logo file, so the name is set in type
 * (never an imitation of a partner logo).
 */
export function Wordmark({ tone = "onLight", size = "md" }: { tone?: "onLight" | "onDark"; size?: "md" | "lg" }) {
  const main = tone === "onDark" ? "text-white" : "text-primary";
  const sub = tone === "onDark" ? "text-lime" : "text-azure";
  return (
    <span className="flex flex-col leading-none">
      <span className={`font-extrabold tracking-[-0.04em] ${main} ${size === "lg" ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"}`}>AGRA–SMEDAN</span>
      <span className={`mt-1 font-semibold tracking-[-0.01em] ${sub} ${size === "lg" ? "text-sm sm:text-base" : "text-xs sm:text-[13px]"}`}>Youth Agri-Innovation Contest</span>
    </span>
  );
}
