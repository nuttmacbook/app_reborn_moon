import { formNumber, shortAddress } from "../web3/connect";

const PANEL = "rounded-3xl border border-sky-300/15 bg-deck/70 backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_60px_-30px_rgb(37_99_235/0.75)]";

const LABEL = "text-xs font-semibold text-sky-300/80";

const TITLE = "font-display text-2xl font-bold leading-tight tracking-wide text-ice sm:text-3xl";

const GLOW_TEXT = "text-white [text-shadow:0_0_10px_rgb(103_232_249/0.85)]";

const SOFT_BTN = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-400/10 px-3 text-sm font-semibold text-sky-100 ring-1 ring-inset ring-sky-300/25 transition hover:bg-sky-400/20 hover:ring-beam/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

const FIELD = "h-10 min-w-0 rounded-xl bg-space/70 px-3 font-mono text-xs text-sky-100 ring-1 ring-inset ring-sky-300/20 placeholder:font-sans placeholder:text-sky-300/50 focus:outline-none focus:ring-2 focus:ring-beam";

/** The one glowing action on a panel — chunky, with a light sweep */
const primaryButton = ({ label, onclick, isDisabled = false, extra = "" }) => /*html*/`
    <button type="button" onclick="${onclick}" ${isDisabled ? "disabled" : ""}
        class="relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300 to-blue-500 px-5 font-display text-lg font-bold tracking-wider text-white [text-shadow:0_1px_0_rgb(30_58_138/0.7)] shadow-[0_4px_0_#1e3a8a,0_0_30px_-6px_rgb(56_189_248/0.9)] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_#1e3a8a,0_0_30px_-6px_rgb(56_189_248/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0 motion-reduce:transition-none ${extra}">
        ${isDisabled ? "" : `<span class="btn-shine" aria-hidden="true"></span>`}
        <span class="relative">${label}</span>
    </button>
`;

const MOON_TONES = {
    own:    "from-white via-sky-100 to-sky-300 animate-halo motion-reduce:animate-none",
    other:  "from-blue-300 via-blue-500 to-indigo-800 shadow-[0_0_12px_rgb(59_130_246/0.45),inset_0_0_0_1px_rgb(191_219_254/0.35)]",
    ice:    "from-white via-cyan-100 to-cyan-400 shadow-[0_0_14px_rgb(103_232_249/0.55)]",
    azure:  "from-sky-200 via-sky-400 to-blue-600 shadow-[0_0_14px_rgb(56_189_248/0.5)]",
    nova:   "from-indigo-200 via-blue-400 to-indigo-700 shadow-[0_0_14px_rgb(129_140_248/0.5)]",
    locked: "from-slate-500 via-slate-600 to-slate-800 opacity-60",
};

/** A cratered moon; the halo on "own" pulses so the player's moons are spotted first */
const moon = ({ tone = "other", size = "h-8 w-8", inner = "" } = {}) => /*html*/`
    <span class="relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${MOON_TONES[tone] ?? MOON_TONES.other}">
        <span class="absolute left-[20%] top-[52%] h-[24%] w-[24%] rounded-full bg-slate-900/15 shadow-[inset_1px_1px_1px_rgb(15_23_42/0.25)]"></span>
        <span class="absolute left-[56%] top-[26%] h-[15%] w-[15%] rounded-full bg-slate-900/15"></span>
        <span class="absolute left-[62%] top-[64%] h-[11%] w-[11%] rounded-full bg-slate-900/10"></span>
        <span class="absolute -left-[12%] -top-[12%] h-[58%] w-[58%] rounded-full bg-white/35 blur-[2px]"></span>
        ${inner ? /*html*/`<span class="relative">${inner}</span>` : ""}
    </span>
`;

const LEG_LABELS = {
    main:    "Your origin moon",
    left:    "Left wing of your origin",
    right:   "Right wing of your origin",
};

// Round 0 is the first moon a pilot launches; every later one is a rebirth
const roundLabel = (round) => (Number(round ?? 0) > 0 ? `Reborn ${Number(round)}` : "Origin");
const roundBadge = (round) => (Number(round ?? 0) > 0 ? `R${Number(round)}` : "Origin");

const placedLabel = (node) => {
    if (!node?.parent) return "Galaxy core";
    return `${node.side === "right" ? "Right" : "Left"} of #${node.parent}`;
};

const formatDate = (seconds) => {
    const date = new Date(Number(seconds ?? 0) * 1000);
    return Number(seconds) > 0 && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "—";
};

/** USDT amounts arrive in wei; this keeps 2 decimals and adds thousand separators */
const usd = (wei) => {
    const value = Number(formNumber(wei ?? 0n, 18, 2));
    return Number.isFinite(value)
        ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "0.00";
};

const addressLabel = (address) => (/^0x[a-fA-F0-9]{40}$/.test(address ?? "") ? shortAddress(address) : "—");

// Address invite links point to (VITE_APP_URL). Empty: the address the app is open on right now.
const APP_URL = String(import.meta.env.VITE_APP_URL ?? "").trim();

/** Invite link carrying a pilot's ID (their origin moon in Sector A) */
const referralLink = (inviteId) => {
    const id = Number(inviteId);
    if (typeof window === "undefined" || !Number.isInteger(id) || id <= 0) return "";
    try {
        const url = new URL(APP_URL || `${window.location.origin}${window.location.pathname}`);
        url.searchParams.set("ref", String(id));
        return url.toString();
    } catch {
        console.error("VITE_APP_URL is not a valid URL:", APP_URL);
        return "";
    }
};

/** Anything typed by the user goes back into HTML through this */
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

/** Small copy button; copyText() in main.js reads data-copy */
const copyButton = (text, label = "Copy") => /*html*/`
    <button type="button" onclick="copyText(this)" data-copy="${escapeHtml(text)}" ${text ? "" : "disabled"} class="${SOFT_BTN}">
        <span data-copy-label aria-live="polite">${label}</span>
    </button>
`;

export {
    PANEL, LABEL, TITLE, GLOW_TEXT, SOFT_BTN, FIELD, primaryButton,
    moon, LEG_LABELS, roundLabel, roundBadge, placedLabel, formatDate, usd,
    addressLabel, referralLink, escapeHtml, copyButton,
};
