import "./main.css";
import { box, modal, switchToPlanChain } from "./web3/connect";
import {
    PACKAGES, nextPackage,
    getUserSummary, getOwnerInfo, getUserPositions, getTreeView, getPlanState, getWalletFunds, getRecruiter,
} from "./web3/readPlan";
import { register } from "./web3/intereacts/register";
import { upgrade } from "./web3/intereacts/upgrade";
import { topBar } from "./componants/topBar";
import { profileCard, joinCard, lockedTree } from "./componants/profileZone";
import { binaryTree } from "./componants/binaryTree";
import { nodeDetail } from "./componants/nodeDetail";
import { positionList, positionBody, PAGE } from "./componants/positionList";
import { notify } from "./componants/notify";
import { PANEL } from "./componants/ui";

/* ------------------------------------ invite link */

const REF_KEY = "rebornmoon:ref";
const GENESIS_ID = 1;

/**
 * Which ID a new pilot launches under.
 * A link with ?ref= wins and is remembered; a plain visit (or a refresh) keeps the last link's ID;
 * someone who never opened an invite link launches under ID 1.
 * @returns {{ id: number, isFromLink: boolean }}
 */
const loadReferrer = () => {
    const raw = new URLSearchParams(window.location.search).get("ref");
    const fromUrl = /^\d+$/.test(raw ?? "") ? Number(raw) : 0;

    try {
        if (fromUrl > 0) {
            localStorage.setItem(REF_KEY, String(fromUrl));
            return { id: fromUrl, isFromLink: true };
        }
        const saved = Number(localStorage.getItem(REF_KEY));
        if (Number.isInteger(saved) && saved > 0) return { id: saved, isFromLink: true };
    } catch {
        // Storage blocked (private mode in some wallets): the link still works for this visit
        if (fromUrl > 0) return { id: fromUrl, isFromLink: true };
    }
    return { id: GENESIS_ID, isFromLink: false };
};

const state = {
    isBooting: true,
    isLoading: false,
    isJoining: false,
    isUpgrading: false,
    hasError: false,
    account: null,
    referrer: loadReferrer(), // { id, isFromLink }
    recruiter: null,          // { id, account } once the ID is resolved on-chain
    referrerStatus: null,     // "checking" | "ok" | "missing" | "error"
    funds: null,            // { balance } in USDT wei
    planState: null,        // { prices } read from the contract
    fingerprint: "",        // last on-chain snapshot, so polling repaints only when something changed
    pkg: PACKAGES[0].key,
    summary: null,
    positions: {},
    owners: {},
    view: null,
    selectedId: null,
    query: "",
    leg: "all",
    limit: PAGE,
};

let loadTicket = 0; // drops responses that arrive after the user already moved on

const REFRESH_MS = 15000;

const isReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** BigInt-safe snapshot used to tell whether a poll found anything new */
const fingerprintOf = (value) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));

/** Don't repaint under someone who is typing, picking from a menu, or waiting on a transaction */
const isBusy = () => {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    const isMenuOpen = Boolean(document.querySelector("[data-dropdown-menu]:not(.hidden)"));
    return isTyping || isMenuOpen || state.isJoining || state.isUpgrading || state.isLoading;
};
const ownerOf = (address) => state.owners[String(address ?? "").toLowerCase()];

/* ------------------------------------ render */

const spinner = /*html*/`
    <div class="grid place-items-center ${PANEL} py-20">
        <span class="h-7 w-7 animate-spin rounded-full border-2 border-sky-300/25 border-t-beam motion-reduce:animate-none" aria-label="Loading"></span>
    </div>
`;

const failed = /*html*/`
    <div class="rounded-3xl bg-rose-500/10 px-5 py-8 text-center ring-1 ring-inset ring-rose-400/30">
        <p class="text-sm font-bold text-rose-200">Lost signal with the chain.</p>
        <p class="mt-1 text-xs text-rose-200/80">Check your network, then try again.</p>
        <button type="button" onclick="reloadData()" class="mt-3 text-sm font-bold text-rose-100 underline underline-offset-4">Reconnect</button>
    </div>
`;

const detailData = () => {
    const node = state.view?.nodes?.[state.selectedId];
    return { node, view: state.view, pkg: state.pkg, owner: node ? ownerOf(node.owner) : undefined };
};

const treeZone = (data) => {
    if (state.hasError) return failed;
    if (state.isLoading) return spinner;
    if (!data.summary?.isMember) return lockedTree;

    // A locked or empty sector has no moon to scan, so the map takes the full width
    if (!data.view) return binaryTree(data);

    return /*html*/`
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            ${binaryTree(data)}

            <!-- การ์ดสแกนดวงจันทร์ที่เลือก -->
            <aside data-node-detail aria-live="polite" class="overflow-hidden ${PANEL} lg:sticky lg:top-20">
                ${nodeDetail(detailData())}
            </aside>
        </div>

        ${data.view ? positionList(data) : ""}
    `;
};

function paint() {
    const app = document.querySelector("#app");
    if (!app) return;

    const loc = window.location.hostname;
    console.log({ loc });
    const isValidLink = loc == "www.rebornmoon.app" //rebornmoon

    if (!isValidLink) {
        return;
    }

    const data = { ...state, positions: state.positions[state.pkg] ?? [], rootId: state.view?.rootId };
    const isMember = Boolean(state.summary?.isMember);

    if (state.isBooting) {
        app.innerHTML = /*html*/`<div class="mx-auto max-w-md px-4 py-24">${spinner}</div>`;
        return;
    }

    app.innerHTML = /*html*/`
    ${topBar(data)}
    <main class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">
        <!-- ข้อมูลนักบิน / สมัครครั้งแรก -->
        ${isMember ? profileCard(data) : joinCard(data)}

        <!-- แผนที่เซกเตอร์ -->
        ${state.account || isMember ? treeZone(data) : lockedTree}
    </main>
    `;
}

const paintDetail = () => {
    const panel = document.querySelector("[data-node-detail]");
    if (panel) panel.innerHTML = nodeDetail(detailData());
};

/** Only the list under the search box, so the input keeps focus while typing */
const paintPositions = () => {
    const el = document.querySelector("[data-position-body]");
    if (!el) return;
    el.innerHTML = positionBody({ ...state, positions: state.positions[state.pkg] ?? [], rootId: state.view?.rootId });
};

/* ------------------------------------ data */

/** The viewer's own pilot card comes from the summary instead of a second read */
function seedOwnPilot() {
    if (!state.account || !state.summary) return;
    state.owners[state.account.toLowerCase()] = {
        referrer: state.summary.referrer ?? null,
        income: state.summary.income ?? 0n,
        positions: Object.values(state.summary.packages ?? {}).reduce((sum, p) => sum + Number(p?.positions ?? 0), 0),
        inviteId: state.summary.packages?.a?.mainId ?? null,
    };
}

async function loadOwner(address) {
    const key = String(address ?? "").toLowerCase();
    if (!key || state.owners[key]) return;
    try {
        state.owners[key] = await getOwnerInfo(address);
    } catch (err) {
        console.error(err);
        state.owners[key] = { failed: true };
    }
}

async function loadPackage(pkg) {
    const ticket = ++loadTicket;
    state.isLoading = true;
    state.hasError = false;
    paint();

    try {
        const mainId = state.summary?.packages?.[pkg]?.mainId;
        const [ positions, view ] = await Promise.all([
            state.positions[pkg] ?? getUserPositions(pkg, state.account, state.summary?.packages?.[pkg]?.positions),
            mainId ? getTreeView(pkg, mainId, state.account, mainId) : null,
        ]);
        if (ticket !== loadTicket) return;

        state.positions[pkg] = positions;
        state.view = view;
        state.selectedId = view?.rootId ?? null;
    } catch (err) {
        console.error(err);
        if (ticket !== loadTicket) return;
        state.hasError = true;
    }

    state.isLoading = false;
    paint();

    const root = state.view?.nodes?.[state.selectedId];
    if (root) loadOwner(root.owner).then(paintDetail);
}

async function onWallet(address) {
    const account = address ?? null;
    state.isBooting = false;

    // Wallet events fire more than once per connect, so skip when nothing changed
    if (account === state.account && (state.summary || !account)) return paint();

    Object.assign(state, {
        account, hasError: false, summary: null, funds: null, positions: {}, owners: {},
        view: null, selectedId: null, query: "", leg: "all", limit: PAGE,
    });
    if (!account) return paint();

    state.isLoading = true;
    paint();
    try {
        const [ summary, funds ] = await Promise.all([ getUserSummary(account), getWalletFunds(account) ]);
        state.summary = summary;
        state.funds = funds;
        seedOwnPilot();
    } catch (err) {
        console.error(err);
        state.isLoading = false;
        state.hasError = true;
        return paint();
    }

    if (!state.summary?.isMember) {
        state.isLoading = false;
        return paint();
    }
    await loadPackage(state.pkg);
}

/* ------------------------------------ handlers */

window.connectWallet = async () => {
    try {
        await modal.open();
    } catch (err) {
        console.error(err);
    }
};

window.openWallet = () => modal.open();

window.switchNetwork = async () => {
    try {
        await switchToPlanChain();
    } catch (err) {
        console.error(err);
        notify.error(err, { title: "Couldn't switch network", retry: "Switch" });
    }
};


// Clearing the account forces onWallet to read everything again
window.reloadData = async () => {
    const account = state.account;
    state.account = null;
    await onWallet(account);
};

window.copyText = async (button) => {
    const text = button?.dataset?.copy ?? "";
    const label = button?.querySelector("[data-copy-label]");
    if (!text) return;

    // Clipboard API needs a secure context; the textarea path covers in-app wallet browsers
    let isCopied = false;
    try {
        await navigator.clipboard.writeText(text);
        isCopied = true;
    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.className = "fixed -left-[999px] opacity-0";
        document.body.appendChild(area);
        area.select();
        isCopied = document.execCommand?.("copy") ?? false;
        area.remove();
    }

    if (!label) return;
    const original = label.dataset.original ?? label.textContent;
    label.dataset.original = original;
    label.textContent = isCopied ? "Copied" : "Copy failed";
    button.classList.toggle("text-moss", isCopied);
    setTimeout(() => {
        label.textContent = original;
        button.classList.remove("text-moss");
    }, 1600);
};

// Launching is Sector A (the first package) only; B and C unlock through upgradeAccount
window.joinPlan = async () => {
    if (state.isJoining) return;
    const pkg = PACKAGES[0];
    const wallet = await box.getCurrentState();

    state.isJoining = true;
    paint();
    try {
        notify.pending({ stage: "checking" });
        const receipt = await register(wallet, pkg, state.referrer.id, { onStep: notify.pending });
        notify.success({ hash: receipt?.transactionHash ?? receipt?.hash });
        state.isJoining = false;
        state.pkg = pkg.key;
        window.reloadData();
    } catch (err) {
        console.error(err);
        notify.error(err);
        state.isJoining = false;
        paint();
    }
};

window.upgradeAccount = async () => {
    if (state.isUpgrading) return;
    const pkg = nextPackage(state.summary);
    if (!pkg) return;
    const wallet = await box.getCurrentState();

    state.isUpgrading = true;
    paint();
    try {
        notify.pending({ stage: "checking" });
        const receipt = await upgrade(wallet, pkg, { onStep: notify.pending });
        notify.success({
            hash: receipt?.transactionHash ?? receipt?.hash,
            title: "Warp complete",
            desc: `${pkg.name} unlocked. Showing its map now.`,
        });
        state.isUpgrading = false;
        // Land on the sector that just unlocked so its new moon is the first thing seen
        state.pkg = pkg.key;
        window.reloadData();
    } catch (err) {
        console.error(err);
        notify.error(err, { title: "Warp failed", retry: "Warp upgrade" });
        state.isUpgrading = false;
        paint();
    }
};

window.selectPackage = (key) => {
    if (!PACKAGES.some((p) => p.key === key)) return;
    if (key === state.pkg) return paint(); // closes the menu
    Object.assign(state, { pkg: key, query: "", leg: "all", limit: PAGE });
    loadPackage(key);
};

// Selecting only swaps the panel so the tree keeps its scroll position
window.selectNode = async (id) => {
    const node = state.view?.nodes?.[id];
    if (!node) return;
    state.selectedId = node.id;

    document.querySelectorAll("[data-node]").forEach((el) => {
        el.toggleAttribute("data-selected", el.dataset.node === String(node.id));
    });
    paintDetail();

    // On stacked layouts the panel sits under the tree, so bring it just into view
    const panel = document.querySelector("[data-node-detail]");
    if (panel && window.matchMedia?.("(max-width: 1023px)").matches) {
        panel.scrollIntoView({ behavior: isReducedMotion() ? "auto" : "smooth", block: "nearest" });
    }

    await loadOwner(node.owner);
    if (state.selectedId === node.id) paintDetail();
};

/**
 * Recentres the sector map on moon `id`.
 * @param {number} id moon (position) number
 * @param {boolean} [shouldScroll=false] scroll up to the map (used from below it)
 * @returns {Promise<boolean>} false when the moon doesn't exist in this sector
 */
window.openNode = async (id, shouldScroll = false) => {
    const ticket = ++loadTicket;
    try {
        const view = await getTreeView(state.pkg, id, state.account, state.summary?.packages?.[state.pkg]?.mainId ?? null);
        if (ticket !== loadTicket || !view) return false;

        state.view = view;
        state.selectedId = view.rootId;
        paint();

        if (shouldScroll) {
            document.querySelector("[data-tree-anchor]")?.scrollIntoView({ behavior: isReducedMotion() ? "auto" : "smooth", block: "start" });
        }

        const root = view.nodes?.[view.rootId];
        if (root) loadOwner(root.owner).then(() => state.selectedId === root.id && paintDetail());
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
};

window.goUp = () => {
    const parent = state.view?.nodes?.[state.view?.rootId]?.parent;
    if (parent) window.openNode(parent);
};

window.goMain = () => {
    const mainId = state.view?.mainId ?? state.summary?.packages?.[state.pkg]?.mainId;
    if (mainId) window.openNode(mainId);
};

window.findPosition = async () => {
    const input = document.querySelector("[data-find-input]");
    const raw = String(input?.value ?? "").trim().replace(/^#/, "");
    const name = PACKAGES.find((p) => p.key === state.pkg)?.name ?? "this sector";

    const isFound = /^\d+$/.test(raw) ? await window.openNode(Number(raw)) : false;
    if (isFound) return;

    // openNode repaints on success only, so the error element is still the current one
    const error = document.querySelector("[data-find-error]");
    if (!error) return;
    error.textContent = raw ? `No moon #${raw} found in ${name}.` : "Type a moon number first.";
    error.classList.remove("hidden");
};

window.filterPositions = (value) => {
    state.query = String(value ?? "");
    state.limit = PAGE;
    paintPositions();
};

window.setLegFilter = (leg) => {
    state.leg = leg;
    state.limit = PAGE;
    paintPositions();
};

window.showMorePositions = () => {
    state.limit += PAGE;
    paintPositions();
};

/* ------------------------------------ live data */

async function loadPlanState() {
    try {
        state.planState = await getPlanState();
    } catch (err) {
        console.error(err); // prices fall back to the built-in list
    }
}

async function checkRecruiter() {
    state.referrerStatus = "checking";
    try {
        state.recruiter = await getRecruiter(state.referrer.id);
        state.referrerStatus = state.recruiter ? "ok" : "missing";
    } catch (err) {
        console.error(err);
        state.referrerStatus = "error";
    }
}

/**
 * Re-reads the chain and repaints only when something changed: a new moon anywhere in the sector,
 * a payout, a warp, or the wallet's USDT. `force` skips the busy check (right after our own tx).
 */
async function refreshData(force = false) {
    if (state.isBooting || (!force && isBusy())) return;
    const account = state.account;
    if (!account) return;

    try {
        // Prices are fixed in the contract and read once at start, so only user data is re-read here
        const [ summary, funds ] = await Promise.all([ getUserSummary(account), getWalletFunds(account) ]);
        const fingerprint = fingerprintOf({ summary, funds });
        if (account !== state.account || (!force && fingerprint === state.fingerprint)) return;

        const isNewMember = summary?.isMember && !state.summary?.isMember;
        // Payouts and new moons change other pilots' numbers too, so cached pilot cards are dropped
        Object.assign(state, { summary, funds, fingerprint, owners: {} });
        seedOwnPilot();
        if (isNewMember) return loadPackage(state.pkg);

        if (summary?.isMember && state.view) {
            const [ positions, view ] = await Promise.all([
                getUserPositions(state.pkg, account, summary?.packages?.[state.pkg]?.positions),
                getTreeView(state.pkg, state.view.rootId, account, summary?.packages?.[state.pkg]?.mainId ?? null),
            ]);
            if (account !== state.account) return;
            state.positions = { [state.pkg]: positions }; // other sectors re-read when opened
            if (view) {
                state.view = view;
                if (!view.nodes?.[state.selectedId]) state.selectedId = view.rootId;
            }
        }
        if (!force && isBusy()) return; // someone started typing while we read
        paint();

        const selected = state.view?.nodes?.[state.selectedId];
        if (selected) loadOwner(selected.owner).then(() => state.selectedId === selected.id && paintDetail());
    } catch (err) {
        console.error(err); // a missed poll is fine; the next one tries again
    }
}

// Lets code outside the app's own handlers ask for a fresh read
window.refreshData = refreshData;

/* ------------------------------------ init */

async function init() {
    paint();

    await Promise.all([ loadPlanState(), checkRecruiter() ]);
    box.safeRenderApp((wallet) => onWallet(wallet?.address));

    // The top bar shows a switch button when the wallet sits on another chain
    modal.subscribeNetwork?.(() => {
        if (!state.isBooting) paint();
    });

    setInterval(() => {
        if (document.visibilityState === "visible") refreshData();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") refreshData();
    });
}

init();
modal.subscribeAccount?.((account) => {
    // Covers switching accounts inside the wallet, which doesn't re-run safeRenderApp
    if (state.isBooting) return;
    const address = account?.isConnected ? account?.address : null;
    if ((address ?? null) !== state.account) onWallet(address);
});
