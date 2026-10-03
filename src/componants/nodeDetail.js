import { PACKAGES } from "../web3/readPlan";
import {
    LABEL, GLOW_TEXT, SOFT_BTN, FIELD,
    moon, roundLabel, placedLabel, formatDate, usd, addressLabel, referralLink, escapeHtml, copyButton,
} from "./ui";

const tile = ({ label, value, tone = "text-ice" }) => /*html*/`
    <div class="min-w-0 rounded-xl bg-space/50 px-3 py-2 ring-1 ring-inset ring-sky-300/10">
        <p class="truncate text-[11px] font-semibold text-sky-300/70">${label}</p>
        <p class="truncate text-sm font-bold tabular-nums ${tone}">${value}</p>
    </div>
`;

const shimmer = /*html*/`<span class="inline-block h-3.5 w-16 animate-pulse rounded bg-sky-300/20 align-middle motion-reduce:animate-none"></span>`;

/**
 * @param {object} data
 * @param {object} data.node    moon (position) from the map view
 * @param {object} data.view    current map view, for the centred moon
 * @param {object} [data.owner] pilot info { referrer, income, positions }, undefined while scanning
 */
const nodeDetail = ({ node, view, pkg, owner }) => {
    if (!node) return /*html*/`<p class="px-5 py-12 text-center text-sm text-sky-300/80">Tap a moon on the map to scan it.</p>`;

    const isMine = Boolean(node.isMine);
    const isRoot = node.id === view?.rootId;
    const isLoading = owner === undefined;
    const hasFailed = Boolean(owner?.failed);
    const sector = PACKAGES.find((p) => p.key === pkg)?.name ?? "";
    // Invite links carry the pilot's ID, which comes with the pilot info read
    const link = owner && !owner.failed ? referralLink(owner.inviteId) : "";
    const ownerValue = (render) => (isLoading ? shimmer : hasFailed ? "—" : render());

    const pilotRow = (label, value, tone = "text-ice") => /*html*/`
        <div class="flex items-center justify-between gap-3 py-1.5">
            <span class="truncate text-sm text-sky-200/85">${label}</span>
            <span class="shrink-0 font-mono text-sm tabular-nums ${tone}">${value}</span>
        </div>
    `;

    return /*html*/`
    <!-- หัวการ์ดสแกน -->
    <header class="flex items-center gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
        <span class="animate-float motion-reduce:animate-none">${moon({ tone: isMine ? "own" : "other", size: "h-14 w-14" })}</span>
        <div class="min-w-0">
            <p class="${LABEL}">Moon scan, ${sector}</p>
            <h2 class="truncate font-display text-3xl font-extrabold tracking-wide tabular-nums ${isMine ? GLOW_TEXT : "text-ice"}">#${node.id}</h2>
            <span class="mt-0.5 inline-block rounded-full px-2 text-[11px] font-semibold leading-5 ring-1 ring-inset ${isMine ? "bg-beam/15 text-beam ring-beam/40" : "bg-blue-500/15 text-sky-100 ring-sky-300/25"}">
                ${isMine ? "Your moon" : "Another pilot's moon"}, ${roundLabel(node.round).toLowerCase()}
            </span>
        </div>
    </header>

    <!-- ข้อมูลดวงจันทร์ -->
    <div class="grid grid-cols-2 gap-2 px-4 pt-4 sm:px-5">
        ${tile({ label: "Layer",         value: Number(node.level ?? 0) + 1 })}
        ${tile({ label: "Orbiting",      value: placedLabel(node) })}
        ${tile({ label: "Launched",      value: formatDate(node.joinedAt) })}
        ${tile({ label: "Direct orbits", value: `${[ node.left, node.right ].filter(Boolean).length} of 2` })}
    </div>

    <!-- นักบินเจ้าของ -->
    <div class="mx-4 mt-4 rounded-2xl bg-space/50 px-3 py-2 ring-1 ring-inset ring-sky-300/10 sm:mx-5">
        <p class="pt-1 ${LABEL}">${isMine ? "You pilot this moon" : "Pilot"}</p>
        <div class="divide-y divide-sky-300/10">
            ${pilotRow("Address", addressLabel(node.owner), isMine ? GLOW_TEXT : "text-ice")}
            ${pilotRow("Recruited by", ownerValue(() => addressLabel(owner.referrer)))}
            ${pilotRow("Stardust earned", ownerValue(() => `$${usd(owner.income)}`), "text-beam")}
            ${pilotRow("Moons owned", ownerValue(() => Number(owner.positions ?? 0)))}
            ${pilotRow("Pilot ID", ownerValue(() => (owner.inviteId ? `#${owner.inviteId}` : "—")))}
        </div>
        <div class="flex gap-2 pb-2 pt-1">
            <input readonly value="${escapeHtml(link)}" onfocus="this.select()" aria-label="Invite beacon of this pilot" class="${FIELD} h-9 flex-1 truncate" />
            ${copyButton(link)}
        </div>
    </div>

    <div class="flex flex-col gap-2 p-4 sm:p-5">
        <button type="button" onclick="openNode(${node.id})" ${isRoot ? "disabled" : ""} class="${SOFT_BTN} h-11 w-full text-sm">
            ${isRoot ? "Map is centred on this moon" : "Centre map here"}
        </button>
        ${node.parent ? /*html*/`
            <button type="button" onclick="openNode(${node.parent})" class="${SOFT_BTN} h-11 w-full bg-transparent text-sm">Fly to parent moon #${node.parent}</button>
        ` : ""}
    </div>
    `;
};

export { nodeDetail };
