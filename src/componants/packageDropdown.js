import { PACKAGES, isUnlocked } from "../web3/readPlan";
import { moon } from "./ui";

const closeDropdowns = (except) => {
    document.querySelectorAll("[data-dropdown]").forEach((el) => {
        if (el.dataset.dropdown === except) return;
        el.querySelector("[data-dropdown-menu]")?.classList.add("hidden");
        el.querySelector("[data-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });
};

// Menus open by toggling classes so the rest of the page isn't repainted
if (typeof window !== "undefined") {
    window.toggleDropdown = (name) => {
        const root = document.querySelector(`[data-dropdown="${name}"]`);
        const menu = root?.querySelector("[data-dropdown-menu]");
        if (!menu) return;

        const isOpen = menu.classList.contains("hidden");
        closeDropdowns(name);
        menu.classList.toggle("hidden", !isOpen);
        root.querySelector("[data-dropdown-trigger]")?.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) menu.querySelector("[aria-selected='true']")?.focus();
    };

    document.addEventListener("click", (e) => {
        if (!e.target?.closest?.("[data-dropdown]")) closeDropdowns();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDropdowns();
    });
}

/**
 * Sector (package) picker.
 * @param {object} options
 * @param {string} options.name      unique per page, used by toggleDropdown
 * @param {string} options.selected  package key
 * @param {string} options.onSelect  name of the window handler that receives the key
 * @param {object} [options.summary] player summary, adds moon counts and lock state
 */
const packageDropdown = ({ name, selected, onSelect, summary = null }) => {
    const current = PACKAGES.find((p) => p.key === selected) ?? PACKAGES[0];
    const owned = (p) => Number(summary?.packages?.[p.key]?.positions ?? 0);

    // Locked sectors stay listed so players see what a warp unlocks
    const isLocked = (p) => Boolean(summary) && !isUnlocked(summary, p.key);
    const toneOf = (p) => (isLocked(p) ? "locked" : p.moon);

    const meta = (p) => {
        if (!summary) return `${p.price} USDT`;
        if (isLocked(p)) return "Locked, needs a warp";
        return `${owned(p)} moon${owned(p) === 1 ? "" : "s"}`;
    };

    return /*html*/`
    <div class="relative" data-dropdown="${name}">
        <button type="button" data-dropdown-trigger onclick="toggleDropdown('${name}')" aria-haspopup="listbox" aria-expanded="false"
            class="flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl bg-space/70 pl-2.5 pr-3 text-left ring-1 ring-inset ring-sky-300/25 transition hover:ring-beam/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam motion-reduce:transition-none">
            ${moon({ tone: toneOf(current), size: "h-7 w-7" })}
            <span class="min-w-0 flex-1">
                <span class="block truncate font-display text-base font-bold tracking-wide text-ice">${current.name}</span>
                <span class="block truncate text-[11px] font-semibold text-sky-300/80">${meta(current)}</span>
            </span>
            <svg viewBox="0 0 20 20" class="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>

        <ul data-dropdown-menu role="listbox" aria-label="Sector"
            class="absolute left-0 right-0 top-full z-30 mt-2 hidden min-w-56 overflow-hidden rounded-2xl border border-sky-300/20 bg-deck p-1.5 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.8),0_0_30px_-10px_rgb(56_189_248/0.5)]">
            ${PACKAGES.map((p) => {
                const isSelected = p.key === current.key;
                return /*html*/`
                    <li>
                        <button type="button" role="option" aria-selected="${isSelected}" onclick="${onSelect}('${p.key}')"
                            class="flex w-full items-center gap-3 rounded-xl py-2 pl-2 pr-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam motion-reduce:transition-none
                            ${isSelected ? "bg-sky-400/15" : "hover:bg-sky-400/10"}">
                            ${moon({ tone: toneOf(p), size: "h-7 w-7" })}
                            <span class="min-w-0 flex-1">
                                <span class="block truncate font-display text-base font-bold tracking-wide text-ice">${p.name}</span>
                                <span class="block truncate text-[11px] font-semibold text-sky-300/80">${meta(p)}</span>
                            </span>
                            ${summary ? `<span class="shrink-0 font-mono text-xs tabular-nums text-beam">$${p.price}</span>` : ""}
                        </button>
                    </li>
                `;
            }).join("")}
        </ul>
    </div>
    `;
};

export { packageDropdown };
