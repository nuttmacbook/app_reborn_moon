import { PACKAGES, nextPackage, isUnlocked } from "../web3/readPlan";
import { packageDropdown } from "./packageDropdown";
import { upgradeButton } from "./profileZone";
import { PANEL, GLOW_TEXT, SOFT_BTN, FIELD, moon, roundBadge, roundLabel } from "./ui";

const DEPTH = 4; // 1 → 2 → 4 → 8

// Full class names so Tailwind's scanner keeps them
const SPANS = [ "col-span-8", "col-span-4", "col-span-2", "col-span-1" ];

// `box` leaves room around the moon for the orbit ring drawn when it's selected
const SIZES = {
    root:   { box: "h-12 w-12 sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]", size: "h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14" },
    normal: { box: "h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14",             size: "h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" },
};

/** Turns the view into fixed-width rows; empty orbits keep their place so every wing lines up under its parent */
const buildLevels = (nodes, rootId) => {
    const levels = [ [ nodes?.[rootId] ? { kind: "node", node: nodes[rootId] } : { kind: "slot" } ] ];

    for (let level = 1; level < DEPTH; level++) {
        levels.push(levels[level - 1].flatMap((cell) => {
            if (cell.kind !== "node") return [ { kind: "ghost" }, { kind: "ghost" } ];
            return [ cell.node.left, cell.node.right ].map((id) => (nodes?.[id] ? { kind: "node", node: nodes[id] } : { kind: "slot" }));
        }));
    }

    return levels;
};

const badge = (text, isVisible = true) => /*html*/`
    <span class="${isVisible ? "" : "invisible"} rounded-full bg-beam/15 px-1.5 font-mono text-[8px] leading-4 text-beam ring-1 ring-inset ring-beam/40 sm:text-[10px]">${text}</span>
`;

const orbitRing = /*html*/`
    <span class="pointer-events-none absolute inset-0 hidden animate-orbit rounded-full border border-dashed border-beam/80 group-data-selected:block motion-reduce:animate-none">
        <span class="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_#67e8f9]"></span>
    </span>
`;

const cell = (c, level, { rootId, selectedId }) => {
    const node = c.node;
    const isNode = c.kind === "node";
    const isGhost = c.kind === "ghost";
    const isLast = level === DEPTH - 1;
    const isRoot = isNode && node.id === rootId;
    const isMine = Boolean(node?.isMine);
    const { box, size } = isRoot ? SIZES.root : SIZES.normal;

    // Pulses start one row later than the row above so the energy reads as flowing downwards
    const delay = `style="animation-delay: ${level * 0.55}s"`;
    const top = level > 0 ? /*html*/`<span class="beam-y h-3 w-px" ${delay}></span>` : "";

    // Empty and ghost orbits keep the spacer so row heights stay equal
    const bottom = isLast ? "" : isNode ? /*html*/`
        <span class="beam-y h-3 w-px" ${delay}></span>
        <span class="beam-x h-px w-1/2" ${delay}></span>
    ` : /*html*/`<span class="h-3 w-px"></span><span class="h-px w-1/2"></span>`;

    const body = isNode ? /*html*/`
        <button type="button" onclick="selectNode(${node.id})" data-node="${node.id}" ${node.id === selectedId ? "data-selected" : ""}
            aria-label="Moon ${node.id}${isMine ? `, yours, ${roundLabel(node.round).toLowerCase()}` : ""}"
            class="group flex min-w-0 max-w-full flex-col items-center gap-0.5 rounded-xl px-0.5 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-beam">
            <span class="relative grid ${box} place-items-center">
                ${orbitRing}
                <span class="animate-float transition group-hover:scale-110 motion-reduce:animate-none motion-reduce:transition-none" style="animation-delay: -${(node.id % 7) * 0.7}s">
                    ${moon({ tone: isMine ? "own" : "other", size })}
                </span>
            </span>
            <span class="max-w-full truncate font-mono text-[9px] tabular-nums sm:text-[11px] lg:text-xs ${isMine ? GLOW_TEXT : "text-sky-200/85"}">#${node.id}</span>
            ${badge(roundBadge(node.round), isMine)}
        </button>
    ` : /*html*/`
        <div class="flex flex-col items-center gap-0.5 px-0.5 pb-1">
            <span class="grid ${box} place-items-center">
                <span class="grid ${size} place-items-center rounded-full border border-dashed border-sky-300/35 text-xs text-sky-300/60">+</span>
            </span>
            <span class="text-[9px] font-medium text-sky-300/60 sm:text-[11px] lg:text-xs">Empty</span>
            ${badge("R0", false)}
        </div>
    `;

    return /*html*/`
        <div class="flex min-w-0 flex-col items-center ${SPANS[level]} ${isGhost ? "invisible" : ""}" ${isGhost ? `aria-hidden="true"` : ""}>
            ${top}
            <div class="flex animate-rise flex-col items-center motion-reduce:animate-none" style="animation-delay: ${level * 90}ms">${body}</div>
            ${bottom}
        </div>
    `;
};

const legend = /*html*/`
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-sky-300/85">
        <span class="flex items-center gap-1.5">${moon({ tone: "own", size: "h-3.5 w-3.5" })}Your moons, R = reborn</span>
        <span class="flex items-center gap-1.5">${moon({ tone: "other", size: "h-3.5 w-3.5" })}Other pilots</span>
        <span class="flex items-center gap-1.5"><span class="h-3.5 w-3.5 rounded-full border border-dashed border-sky-300/50"></span>Empty orbit</span>
    </div>
`;

const treeNav = ({ view }) => {
    const path = Array.isArray(view?.path) ? view.path : [];
    const rootId = view?.rootId;
    const isMain = rootId === view?.mainId;

    // Reborn moons can sit 10+ layers down, so keep the core and the last three
    const shown = path.length > 4 ? [ path[0], null, ...path.slice(-3) ] : path;

    const crumb = (id) => {
        if (!id) return /*html*/`<span class="text-sky-300/50">…</span>`;
        const isCurrent = id === rootId;
        return /*html*/`
            <button type="button" onclick="openNode(${id})" ${isCurrent ? `aria-current="true"` : ""}
                class="shrink-0 rounded-lg px-1.5 py-1 font-mono text-xs tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam
                ${isCurrent ? "bg-beam/15 text-beam" : "text-sky-300/80 hover:text-ice"}">#${id}</button>
        `;
    };

    return /*html*/`
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Flight path from the galaxy core" class="flex min-w-0 items-center gap-0.5 overflow-x-auto">
                ${shown.map(crumb).join(`<span class="shrink-0 text-sky-300/40">›</span>`)}
            </nav>
            <div class="flex min-w-0 flex-col gap-1">
                <div class="flex min-w-0 items-center gap-2">
                    <input data-find-input type="text" inputmode="numeric" autocomplete="off" placeholder="Moon #"
                        onkeydown="event.key === 'Enter' && findPosition()" aria-label="Moon number to scan"
                        class="${FIELD} h-9 flex-1 tabular-nums sm:w-28 sm:flex-none" />
                    <button type="button" onclick="findPosition()" class="${SOFT_BTN}">Scan</button>
                    <button type="button" onclick="goUp()" ${path.length > 1 ? "" : "disabled"} class="${SOFT_BTN}" aria-label="Up one layer">Up</button>
                    <button type="button" onclick="goMain()" ${isMain || !view?.mainId ? "disabled" : ""} class="${SOFT_BTN}">Origin</button>
                </div>
                <p data-find-error role="status" class="hidden text-xs font-semibold text-rose-300"></p>
            </div>
        </div>
    `;
};

/** What the map says when the picked sector isn't unlocked for this pilot */
const lockedPackage = ({ pkg, summary, isUpgrading, funds }) => {
    const name = PACKAGES.find((p) => p.key === pkg)?.name ?? "This sector";
    const next = nextPackage(summary);
    const isNext = next?.key === pkg;

    return /*html*/`
        <div class="radar-grid flex flex-col items-center gap-3 rounded-2xl px-4 py-10 text-center ring-1 ring-inset ring-sky-300/10">
            ${moon({ tone: "locked", size: "h-14 w-14" })}
            <div>
                <p class="font-display text-xl font-bold tracking-wide text-ice">${name} is locked</p>
                <p class="mx-auto mt-1 max-w-xs text-sm text-sky-300/80">
                    ${isNext ? `Warp upgrade to unlock ${name} and start its map.` : `Sectors unlock in order. Unlock ${next?.name ?? "the one before"} first.`}
                </p>
            </div>
            ${isNext ? `<div class="flex w-full max-w-xs flex-col gap-1.5">${upgradeButton({ summary, isUpgrading, funds })}</div>` : ""}
        </div>
    `;
};

const binaryTree = ({ view, selectedId, pkg, summary, isUpgrading, funds }) => {
    const levels = buildLevels(view?.nodes, view?.rootId);

    return /*html*/`
    <section data-tree-anchor class="${PANEL} relative z-10 flex min-w-0 scroll-mt-20 flex-col gap-4 p-3 sm:p-5" aria-label="Sector map">
        <!-- หัวแผนที่ + เลือกเซกเตอร์ -->
        <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="font-display text-2xl font-bold tracking-wide text-ice">Sector map</h2>
            <div class="sm:w-64">${packageDropdown({ name: "view", selected: pkg, onSelect: "selectPackage", summary })}</div>
        </header>

        ${view ? treeNav({ view }) : ""}

        ${view ? /*html*/`
            <!-- แผนที่ 4 ชั้น -->
            <div class="radar-grid overflow-x-auto rounded-2xl py-4 ring-1 ring-inset ring-sky-300/10 sm:py-6">
                <div class="min-w-[300px] px-1 sm:px-3">
                    ${levels.map((cells, level) => /*html*/`
                        <!-- ชั้น ${level + 1} -->
                        <div class="grid grid-cols-8">
                            ${cells.map((c) => cell(c, level, { rootId: view.rootId, selectedId })).join("")}
                        </div>
                    `).join("")}
                </div>
            </div>

            ${legend}
        ` : !isUnlocked(summary, pkg) ? lockedPackage({ pkg, summary, isUpgrading, funds }) : /*html*/`
            <p class="radar-grid rounded-2xl px-4 py-10 text-center text-sm text-sky-300/80">No moons in this sector yet.</p>
        `}
    </section>
    `;
};

export { binaryTree };
