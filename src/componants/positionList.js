import { PACKAGES } from "../web3/readPlan";
import { PANEL, FIELD, SOFT_BTN, GLOW_TEXT, moon, LEG_LABELS, roundLabel, placedLabel, escapeHtml } from "./ui";

const PAGE = 24; // hundreds of reborn moons would make the page heavy, so reveal in pages

const LEGS = [
    { key: "all",     label: "All" },
    { key: "left",    label: "Left wing" },
    { key: "right",   label: "Right wing" },
];

/** Matches "#120", "120" or "r3" (reborn count) */
const matchesQuery = (p, query) => {
    const q = String(query ?? "").trim().toLowerCase().replace(/^#/, "");
    if (!q) return true;
    if (/^r\d+$/.test(q)) return String(p.round) === q.slice(1);
    return String(p.id).includes(q);
};

const filterPositions = (positions, { query, leg }) => {
    const list = Array.isArray(positions) ? positions : [];
    return list.filter((p) => (leg === "all" || p.leg === leg) && matchesQuery(p, query));
};

const tag = (text) => /*html*/`
    <span class="shrink-0 rounded-full bg-white/90 px-2 text-[10px] font-bold leading-5 text-blue-900 shadow-[0_0_10px_rgb(186_230_253/0.8)]">${text}</span>
`;

const row = (p, { rootId, latestId, fillingId }) => {
    const isActive = p.id === rootId;

    return /*html*/`
        <button type="button" onclick="openNode(${p.id}, true)" ${isActive ? `aria-current="true"` : ""}
            class="flex min-w-0 items-center gap-3 rounded-2xl py-2.5 pl-3 pr-3 text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam motion-reduce:transition-none
            ${isActive ? "bg-beam/10 ring-beam/50 shadow-[0_0_20px_-6px_rgb(103_232_249/0.6)]" : "bg-space/50 ring-sky-300/10 hover:bg-sky-400/10 hover:ring-sky-300/30"}">
            ${moon({ tone: "own", size: "h-8 w-8" })}
            <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2">
                    <span class="flex min-w-0 items-center gap-1.5">
                        <span class="font-mono text-sm tabular-nums ${GLOW_TEXT}">#${p.id}</span>
                        ${p.id === latestId ? tag("Newest") : ""}
                        ${p.id === fillingId ? tag("Filling") : ""}
                    </span>
                    <span class="shrink-0 rounded-full bg-beam/15 px-2 text-[10px] font-semibold leading-5 text-beam ring-1 ring-inset ring-beam/35">${roundLabel(p.round)}</span>
                </span>
                <span class="block truncate text-xs text-sky-100/85">Layer ${Number(p.level ?? 0) + 1}, ${placedLabel(p).toLowerCase()}</span>
                <span class="block truncate text-[11px] font-medium text-beam/90">${LEG_LABELS[p.leg] ?? "—"}</span>
            </span>
        </button>
    `;
};

/** Everything under the scan box — repainted alone so typing keeps focus */
const positionBody = ({ positions, query = "", leg = "all", limit = PAGE, rootId, summary, pkg }) => {
    const board = summary?.packages?.[pkg];
    const marks = { rootId, latestId: board?.latestId ?? null, fillingId: board?.fillingId ?? null };
    const list = Array.isArray(positions) ? positions : [];
    const filtered = filterPositions(list, { query, leg });
    const shown = filtered.slice(0, limit);
    const countOf = (key) => (key === "all" ? list.length : list.filter((p) => p.leg === key).length);

    return /*html*/`
        <div class="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by wing">
            ${LEGS.map((l) => /*html*/`
                <button type="button" onclick="setLegFilter('${l.key}')" aria-pressed="${leg === l.key}"
                    class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam motion-reduce:transition-none
                    ${leg === l.key ? "bg-beam/15 text-beam ring-beam/45" : "bg-space/50 text-sky-100 ring-sky-300/15 hover:bg-sky-400/10"}">
                    ${l.label}<span class="tabular-nums opacity-70">${countOf(l.key)}</span>
                </button>
            `).join("")}
        </div>

        ${shown.length > 0 ? /*html*/`
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                ${shown.map((p) => row(p, marks)).join("")}
            </div>
        ` : /*html*/`
            <p class="rounded-2xl bg-space/50 px-4 py-8 text-center text-sm text-sky-300/80">No moon matches. Clear the scan or pick another wing.</p>
        `}

        <div class="flex flex-col items-center gap-2 pt-1">
            <p class="text-xs font-medium tabular-nums text-sky-300/70">Showing ${shown.length} of ${filtered.length}</p>
            ${filtered.length > shown.length ? /*html*/`
                <button type="button" onclick="showMorePositions()" class="${SOFT_BTN}">Show ${Math.min(PAGE, filtered.length - shown.length)} more</button>
            ` : ""}
        </div>
    `;
};

const positionList = (data) => {
    const sector = PACKAGES.find((p) => p.key === data?.pkg)?.name ?? "this sector";
    const total = Array.isArray(data?.positions) ? data.positions.length : 0;

    return /*html*/`
    <section class="${PANEL} flex min-w-0 flex-col gap-3 p-4 sm:p-5" aria-label="Your moon fleet">
        <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
                <h2 class="font-display text-2xl font-bold tracking-wide text-ice">Moon fleet in ${sector} <span class="tabular-nums ${GLOW_TEXT}">${total}</span></h2>
                <p class="text-sm text-sky-300/80">Every rebirth adds a moon. Tap one to fly to it on the map.</p>
            </div>
            <input type="search" value="${escapeHtml(data?.query)}" oninput="filterPositions(this.value)" autocomplete="off"
                placeholder="Scan #id or r3" aria-label="Scan your moons" class="${FIELD} w-full sm:w-52" />
        </header>

        <div data-position-body class="flex flex-col gap-3">
            ${positionBody(data)}
        </div>
    </section>
    `;
};

export { positionList, positionBody, PAGE };
