import { PACKAGES, nextPackage, isUnlocked } from "../web3/readPlan";
import {
    PANEL, LABEL, TITLE, GLOW_TEXT, FIELD, primaryButton,
    moon, usd, addressLabel, referralLink, escapeHtml, copyButton,
} from "./ui";

/* ------------------------------------ art */

const ORBIT = "M16 104a104 30 0 1 0 208 0a104 30 0 1 0-208 0";

// A glowing moon with two satellites; `key` keeps gradient ids unique when it appears twice on a page
const moonArt = (extra = "", key = "a") => /*html*/`
    <svg viewBox="0 0 240 200" class="${extra}" aria-hidden="true">
        <defs>
            <radialGradient id="m-body-${key}" cx=".35" cy=".3" r=".8">
                <stop offset="0" stop-color="#ffffff" /><stop offset=".55" stop-color="#bae6fd" /><stop offset="1" stop-color="#3b82f6" />
            </radialGradient>
            <filter id="m-glow-${key}" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
        </defs>
        <g fill="#fff">
            <path d="M28 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" opacity=".8" />
            <path d="M206 168l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" opacity=".6" />
            <circle cx="200" cy="34" r="1.2" opacity=".7" /><circle cx="42" cy="170" r="1" opacity=".6" /><circle cx="176" cy="18" r=".9" opacity=".5" />
        </g>
        <g transform="rotate(-12 120 104)">
            <path d="${ORBIT}" fill="none" stroke="#7dd3fc" stroke-opacity=".35" stroke-dasharray="4 5" />
            <circle cx="120" cy="104" r="42" fill="url(#m-body-${key})" filter="url(#m-glow-${key})" />
            <circle cx="104" cy="114" r="8" fill="#0b1633" opacity=".12" />
            <circle cx="134" cy="92" r="5" fill="#0b1633" opacity=".12" />
            <circle cx="132" cy="122" r="3.5" fill="#0b1633" opacity=".1" />
            <g class="orbit-sat">
                <circle r="9" fill="#67e8f9" opacity=".25">
                    <animateMotion dur="9s" repeatCount="indefinite" path="${ORBIT}" />
                </circle>
                <circle r="5" fill="#f0f9ff">
                    <animateMotion dur="9s" repeatCount="indefinite" path="${ORBIT}" />
                </circle>
                <circle r="3.5" fill="#60a5fa">
                    <animateMotion dur="9s" begin="-4.5s" repeatCount="indefinite" path="${ORBIT}" />
                </circle>
            </g>
        </g>
    </svg>
`;

/* ------------------------------------ funds */

const priceWeiOf = (pkg) => pkg?.priceWei ?? BigInt(pkg?.price ?? 0n) * 10n ** 18n;

/** null while the balance hasn't been read yet, so buttons aren't blocked by a slow RPC */
const canAfford = (funds, pkg) => (funds ? funds.balance >= priceWeiOf(pkg) : null);

const balanceLine = (funds, pkg) => {
    if (!funds) return "";
    const isEnough = canAfford(funds, pkg);
    return /*html*/`
        <p class="text-center text-xs ${isEnough ? "text-sky-300/80" : "font-semibold text-rose-300"}">
            Wallet balance <span class="font-mono tabular-nums">${usd(funds.balance)}</span> USDT${isEnough ? "" : `, ${pkg.price} needed`}
        </p>
    `;
};

/* ------------------------------------ warp upgrade */

const lockIcon = /*html*/`
    <svg viewBox="0 0 24 24" class="h-3 w-3 text-slate-100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
`;

/** The one way to unlock the next sector (package); also used on the map when a locked sector is picked */
const upgradeButton = ({ summary, isUpgrading, funds }) => {
    const next = nextPackage(summary);
    if (!next) return /*html*/`
        <p class="rounded-2xl bg-beam/10 px-4 py-3 text-center text-sm font-bold text-beam ring-1 ring-inset ring-beam/30">All sectors unlocked</p>
    `;

    const isShort = canAfford(funds, next) === false;
    return /*html*/`
        ${primaryButton({ label: isUpgrading ? "Warping…" : "Warp upgrade", onclick: "upgradeAccount()", isDisabled: isUpgrading || isShort, extra: "w-full" })}
        <p class="text-center text-xs text-sky-300/80">Unlocks ${next.name} for ${next.price} USDT</p>
        ${isShort ? balanceLine(funds, next) : ""}
    `;
};

/** Sectors unlock in order, drawn as a route of moons — lit when unlocked, grey with a lock when not */
const sectorClearance = ({ summary, isUpgrading, funds }) => {
    const step = (p, i) => {
        const isOpen = isUnlocked(summary, p.key);
        const isNext = nextPackage(summary)?.key === p.key;
        return /*html*/`
            ${i > 0 ? /*html*/`<span class="h-0.5 w-5 shrink-0 rounded-full sm:w-10 ${isOpen ? "beam-x" : "bg-sky-300/15"}" aria-hidden="true"></span>` : ""}
            <li class="flex min-w-0 flex-col items-center gap-1">
                ${moon({ tone: isOpen ? p.moon : "locked", size: "h-8 w-8", inner: isOpen ? "" : lockIcon })}
                <span class="truncate text-[11px] font-bold ${isOpen ? "text-ice" : isNext ? "text-beam" : "text-sky-300/45"}">${p.name}</span>
            </li>
        `;
    };

    return /*html*/`
        <div class="mt-5 grid gap-4 rounded-2xl bg-space/50 p-3 ring-1 ring-inset ring-sky-300/10 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center sm:p-4">
            <div class="min-w-0">
                <p class="${LABEL}">Sector clearance</p>
                <ol class="mt-2 flex items-center" aria-label="Sectors, unlocked in order">
                    ${PACKAGES.map(step).join("")}
                </ol>
            </div>
            <div class="flex flex-col gap-1.5">${upgradeButton({ summary, isUpgrading, funds })}</div>
        </div>
    `;
};

/* ------------------------------------ pilot */

const plaque = ({ label, value, sub = "", tone = "text-ice" }) => /*html*/`
    <div class="min-w-0 rounded-2xl bg-space/50 px-4 py-3 ring-1 ring-inset ring-sky-300/10">
        <p class="truncate ${LABEL}">${label}</p>
        <p class="mt-0.5 truncate font-display text-2xl font-bold tracking-wide tabular-nums ${tone}">${value}</p>
        ${sub ? /*html*/`<p class="truncate text-[11px] font-medium text-sky-300/70">${sub}</p>` : ""}
    </div>
`;

/** A plaque that flies the map to the spot it names */
const jumpPlaque = ({ id, label, sub, sector }) => /*html*/`
    <button type="button" onclick="openNode(${id ?? 0}, true)" ${id ? "" : "disabled"}
        class="min-w-0 rounded-2xl text-left transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam disabled:pointer-events-none motion-reduce:transition-none">
        ${plaque({ label: `${label}, ${sector}`, value: id ? `#${id}` : "—", sub: id ? sub : `None in ${sector}` })}
    </button>
`;

const profileCard = ({ account, summary, pkg, isUpgrading, funds }) => {
    const packages = Object.values(summary?.packages ?? {});
    const held = packages.reduce((sum, p) => sum + Number(p?.positions ?? 0), 0);
    const rebirths = packages.reduce((sum, p) => sum + Number(p?.reinvests ?? 0), 0);
    const latestId = summary?.packages?.[pkg]?.latestId ?? null;
    const fillingId = summary?.packages?.[pkg]?.fillingId ?? null;
    const sector = PACKAGES.find((p) => p.key === pkg)?.name ?? "";
    const inviteId = summary?.packages?.a?.mainId ?? null;
    const link = referralLink(inviteId);

    return /*html*/`
    <section class="${PANEL} p-4 sm:p-6" aria-label="Pilot profile">
        <div class="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8">
            <!-- นักบิน -->
            <div class="flex min-w-0 items-center gap-4">
                <span class="animate-float motion-reduce:animate-none">${moon({ tone: "own", size: "h-16 w-16" })}</span>
                <div class="min-w-0">
                    <p class="${LABEL}">Pilot address</p>
                    <div class="flex min-w-0 items-center gap-2">
                        <span class="truncate font-mono text-base tabular-nums text-ice">${addressLabel(account)}</span>
                        ${copyButton(account)}
                    </div>
                    <p class="mt-1 truncate text-xs text-sky-300/80">
                        Pilot ID <span class="font-mono tabular-nums ${GLOW_TEXT}">#${inviteId ?? "—"}</span>
                    </p>
                    <p class="truncate text-xs text-sky-300/80">
                        Recruited by <span class="font-mono tabular-nums text-sky-100">${addressLabel(summary?.referrer)}</span>
                    </p>
                </div>
            </div>

            <!-- สถิติ -->
            <div class="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                ${plaque({ label: "Stardust earned", value: `$${usd(summary?.income)}`, sub: "USDT earned in every sector", tone: GLOW_TEXT })}
                ${plaque({ label: "Moons owned", value: held, sub: `${rebirths} reborn` })}
                ${jumpPlaque({ id: latestId, label: "Newest moon", sub: "Invites through your beacon land here", sector })}
                ${jumpPlaque({ id: fillingId, label: "Base filling", sub: "Your next rebirth lands under it", sector })}
            </div>
        </div>

        <!-- ระดับเซกเตอร์ + วาร์ปอัพเกรด -->
        ${sectorClearance({ summary, isUpgrading, funds })}

        <!-- ลิ้งก์แนะนำ -->
        <div class="mt-5 flex flex-col gap-2 border-t border-sky-300/10 pt-4 sm:flex-row sm:items-center">
            <label for="ref-link" class="shrink-0 ${LABEL}">Invite beacon, ID #${inviteId ?? "—"}</label>
            <div class="flex min-w-0 flex-1 gap-2">
                <input id="ref-link" readonly value="${escapeHtml(link)}" onfocus="this.select()" class="${FIELD} flex-1 truncate" />
                ${copyButton(link, "Copy beacon")}
            </div>
        </div>
    </section>
    `;
};

/* ------------------------------------ launch */

const joinCard = ({ account, referrer, recruiter, referrerStatus, funds, isJoining }) => {
    const pkg = PACKAGES[0]; // launching always starts at the first sector; the rest unlock through warp upgrades
    const isSelf = Boolean(recruiter && account) && recruiter.account.toLowerCase() === String(account).toLowerCase();
    const isShort = canAfford(funds, pkg) === false;
    const canJoin = Boolean(account) && !isJoining && !isSelf && !isShort && referrerStatus === "ok";

    // Resolved on-chain: the ID only works if a moon with that number exists
    const recruiterState = {
        checking: `<p class="mt-2 text-xs text-sky-300/70">Checking this ID on-chain…</p>`,
        ok:       `<p class="mt-2 text-xs font-semibold text-beam">Active pilot, ready to recruit</p>`,
        missing:  `<p class="mt-2 text-xs font-semibold text-rose-300">There's no pilot with ID #${referrer.id}. Check the link you were sent.</p>`,
        error:    `<p class="mt-2 text-xs font-semibold text-rose-300">Couldn't reach the chain to check this ID. Refresh to try again.</p>`,
    }[referrerStatus] ?? "";

    const recruiterBox = /*html*/`
        <div class="rounded-2xl bg-space/50 p-3 ring-1 ring-inset ${isSelf || referrerStatus === "missing" ? "ring-rose-400/40" : "ring-beam/30"}">
            <p class="${LABEL}">Launching under</p>
            <p class="flex items-baseline gap-2">
                <span class="font-display text-2xl font-bold tabular-nums ${GLOW_TEXT}">#${referrer.id}</span>
                ${recruiter ? `<span class="truncate font-mono text-xs text-sky-300/80">${addressLabel(recruiter.account)}</span>` : ""}
            </p>
            <p class="mt-1 text-[11px] text-sky-300/70">${referrer.isFromLink ? "From the invite link you opened" : "No invite link opened, so you launch under Genesis"}</p>
            ${isSelf ? `<p class="mt-2 text-xs font-semibold text-rose-300">This is your own ID. Open the invite link of the pilot who invited you.</p>` : recruiterState}
        </div>
    `;

    const action = account ? /*html*/`
        ${primaryButton({ label: isJoining ? "Launching…" : `Launch for ${pkg.price} USDT`, onclick: "joinPlan()", isDisabled: !canJoin, extra: "w-full" })}
        ${isShort ? balanceLine(funds, pkg) : `<p class="text-center text-xs text-sky-300/80">Your wallet asks twice the first time: approve USDT, then launch.</p>`}
    ` : /*html*/`
        ${primaryButton({ label: "Connect wallet to launch", onclick: "connectWallet()", extra: "w-full" })}
        <p class="text-center text-xs text-sky-300/80">Nothing is signed until you press Launch.</p>
    `;

    return /*html*/`
    <section class="${PANEL} relative z-10 p-5 sm:p-8" aria-label="Launch">
        <div class="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
            <div class="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
                <div>
                    <h1 class="${TITLE}">Claim your first moon</h1>
                    <p class="mt-2 max-w-prose text-sm leading-relaxed text-sky-100/85">
                        Launch under the pilot who invited you. Every rebirth later adds another moon to your sector map.
                    </p>
                </div>

                ${recruiterBox}

                <!-- เซกเตอร์เริ่มต้น -->
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-3 rounded-2xl bg-space/50 py-2.5 pl-3 pr-4 ring-1 ring-inset ring-sky-300/15">
                        ${moon({ tone: pkg.moon, size: "h-9 w-9" })}
                        <div class="min-w-0 flex-1">
                            <p class="${LABEL}">Starting sector</p>
                            <p class="truncate font-display text-lg font-bold tracking-wide text-ice">${pkg.name}</p>
                        </div>
                        <span class="shrink-0 font-mono text-base tabular-nums text-beam">${pkg.price} USDT</span>
                    </div>
                    <p class="text-xs text-sky-300/80">Every pilot starts in ${pkg.name}. ${PACKAGES.slice(1).map((p) => p.name).join(" and ")} unlock later with Warp upgrade.</p>
                </div>

                <div class="flex flex-col gap-2 pt-1">${action}</div>
            </div>

            ${moonArt("order-1 mx-auto h-40 w-48 sm:h-52 sm:w-60 lg:order-2 lg:h-72 lg:w-80", "j")}
        </div>
    </section>
    `;
};

/** Stands in for the map until the wallet owns a moon */
const lockedTree = /*html*/`
    <section class="${PANEL} px-6 py-12 text-center">
        ${moonArt("mx-auto h-28 w-32 opacity-50", "l")}
        <h2 class="mt-3 font-display text-xl font-bold tracking-wide text-ice">Your sector map lights up here</h2>
        <p class="mx-auto mt-1 max-w-sm text-sm text-sky-300/80">Launch to see your origin moon, the 8 orbits below it, and every reborn moon you add later.</p>
    </section>
`;

export { profileCard, joinCard, lockedTree, upgradeButton };
