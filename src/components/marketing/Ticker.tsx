import { ticker } from "@/content/home";

/** Scoreboard ticker strip. The list is rendered twice so the loop is seamless. */
export function Ticker() {
  return (
    <div className="overflow-hidden border-y-4 border-charcoal bg-gold py-3 text-charcoal">
      <div className="flex w-max animate-ticker">
        {[false, true].map((isCopy) => (
          <ul
            key={String(isCopy)}
            aria-hidden={isCopy}
            className="flex shrink-0 items-center"
          >
            {ticker.map((item) => (
              <li
                key={item}
                className="flex items-center font-display text-lg font-semibold uppercase tracking-widest whitespace-nowrap"
              >
                <span className="px-6">{item}</span>
                <span aria-hidden="true" className="text-tomato">
                  ★
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
