import { RebornMoon } from "./contracts/contract_plan";
import { Tether } from "./contracts/contract_tether";
import { call } from "./multicall";

// Every read goes through call(), so reads started together reach the chain as one Multicall3 request.

// Packages are shown to players as sectors. `id` is the contract's packageId.
// Prices here are a fallback only — getPlanState() overwrites them with priceOf() from the contract.
const PACKAGES = [
    { key: "a", id: 1, name: "Sector A", price: 20n,  moon: "ice" },
    { key: "b", id: 2, name: "Sector B", price: 100n, moon: "azure" },
    { key: "c", id: 3, name: "Sector C", price: 500n, moon: "nova" },
];

const ZERO = "0x0000000000000000000000000000000000000000";

const SIDES = [ null, "left", "right" ];    // SpotView.side
const LEGS = [ "main", "left", "right" ];   // SpotView.branch
const ID_PAGE = 200;                        // ids per getUserSpots call
const SPOT_PAGE = 100;                      // spots per getSpots call

/* ------------------------------------ helpers */

const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value ?? "");

const sameAddress = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

/** Packages open in order, so the next one is the first the wallet hasn't unlocked; null once all are open */
const nextPackage = (summary) => {
    const unlocked = Array.isArray(summary?.unlocked) ? summary.unlocked : [];
    return PACKAGES.find((p) => !unlocked.includes(p.key)) ?? null;
};

const isUnlocked = (summary, key) => Array.isArray(summary?.unlocked) && summary.unlocked.includes(key);

const packageIdOf = (key) => PACKAGES.find((p) => p.key === key)?.id ?? 0;

/** Decoded structs can be read by name or by position */
const field = (obj, name, index) => obj?.[name] ?? obj?.[index];

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** SpotView from the contract → the node shape every component uses */
const toNode = (v, account) => {
    const id = Number(field(v, "id", 0) ?? 0);
    if (!id) return null;
    const owner = field(v, "account", 1);
    return {
        id,
        owner,
        isMine: sameAddress(owner, account),
        round: Number(field(v, "round", 2) ?? 0),
        joinedAt: Number(field(v, "createdAt", 3) ?? 0),
        parent: Number(field(v, "parent", 4) ?? 0) || null,
        left: Number(field(v, "left", 5) ?? 0) || null,
        right: Number(field(v, "right", 6) ?? 0) || null,
        level: Number(field(v, "depth", 7) ?? 0),
        side: SIDES[Number(field(v, "side", 8) ?? 0)] ?? null,
        leg: LEGS[Number(field(v, "branch", 9) ?? 0)] ?? "main",
    };
};

/** getUserInfo + one getUserBoard per package */
async function readAccount(account) {
    const [ info, ...boards ] = await Promise.all([
        call(RebornMoon, "getUserInfo", [ account ]),
        ...PACKAGES.map((p) => call(RebornMoon, "getUserBoard", [ account, p.id ])),
    ]);

    const rawReferrer = field(info, "referrer", 0);
    const isMember = isAddress(rawReferrer) && !sameAddress(rawReferrer, ZERO);
    // Genesis is its own referrer; nobody recruited it
    const referrer = isMember && !sameAddress(rawReferrer, account) ? rawReferrer : null;

    return {
        isMember,
        referrer,
        income: BigInt(field(info, "totalProfit", 1) ?? 0),
        unlockedCount: Number(field(info, "unlocked", 2) ?? 0),
        boards: boards.map((b) => ({
            positions: Number(field(b, "count", 0) ?? 0),
            mainId: Number(field(b, "firstId", 1) ?? 0) || null,
            latestId: Number(field(b, "newestId", 2) ?? 0) || null,
            fillingId: Number(field(b, "fillingId", 3) ?? 0) || null,
        })),
    };
}

/* ------------------------------------ reads */

/**
 * Sector prices straight from priceOf(), written into PACKAGES so every screen and every payment
 * uses the contract's numbers.
 * @returns {Promise<{ prices: string[] }>}
 */
export async function getPlanState() {
    const prices = await Promise.all(PACKAGES.map((p) => call(RebornMoon, "priceOf", [ p.id ])));

    PACKAGES.forEach((p, i) => {
        p.priceWei = BigInt(prices[i] ?? 0);
        p.price = p.priceWei / 10n ** 18n;
    });

    return { prices: PACKAGES.map((p) => String(p.price)) };
}

/**
 * One wallet across every package.
 * `latestId` is where invites through this wallet's link land; `fillingId` is the own spot whose
 * 16-seat base the next reinvest fills.
 * @param {string} account wallet address
 * @returns {Promise<{ isMember: boolean, referrer: string|null, income: bigint, unlocked: string[], packages: Object<string, { mainId: number|null, latestId: number|null, fillingId: number|null, positions: number, reinvests: number }> }>}
 */
export async function getUserSummary(account) {
    if (!isAddress(account)) return { isMember: false, referrer: null, income: 0n, unlocked: [], packages: {} };

    const data = await readAccount(account);
    if (!data.isMember) return { isMember: false, referrer: null, income: 0n, unlocked: [], packages: {} };

    const packages = Object.fromEntries(PACKAGES.map((p, i) => {
        const b = data.boards[i];
        return [ p.key, { ...b, reinvests: Math.max(0, b.positions - 1) } ];
    }));

    return {
        isMember: true,
        referrer: data.referrer,
        income: data.income,
        unlocked: PACKAGES.slice(0, data.unlockedCount).map((p) => p.key),
        packages,
    };
}

/**
 * Public info about whoever owns a spot — shown when someone taps another pilot's moon.
 * @param {string} owner owner address
 * @returns {Promise<{ referrer: string|null, income: bigint, positions: number, inviteId: number|null }>}
 */
export async function getOwnerInfo(owner) {
    if (!isAddress(owner)) return { referrer: null, income: 0n, positions: 0, inviteId: null };

    const data = await readAccount(owner);
    const positions = data.boards.reduce((sum, b) => sum + b.positions, 0);
    return { referrer: data.referrer, income: data.income, positions, inviteId: data.boards[0]?.mainId ?? null };
}

/**
 * Every spot a wallet holds in one package — the main one plus each reinvest, in order.
 * Two requests: the ids (pages of 200), then their details (pages of 100), each batched into one.
 * @param {string} pkg package key
 * @param {string} account wallet address
 * @param {number} count spot count from getUserSummary
 * @returns {Promise<Array<{ id: number, round: number, level: number, parent: number|null, side: "left"|"right"|null, leg: "main"|"left"|"right", joinedAt: number }>>}
 */
export async function getUserPositions(pkg, account, count) {
    const total = Number(count ?? 0);
    if (!isAddress(account) || total <= 0) return [];

    const packageId = packageIdOf(pkg);
    const idPages = await Promise.all(
        Array.from({ length: Math.ceil(total / ID_PAGE) }, (_, i) => call(RebornMoon, "getUserSpots", [ account, packageId, i * ID_PAGE, ID_PAGE ]))
    );
    const ids = idPages.flatMap((page) => Array.from(page ?? [], Number)).filter(Boolean);

    const viewPages = await Promise.all(chunk(ids, SPOT_PAGE).map((page) => call(RebornMoon, "getSpots", [ packageId, page ])));
    return viewPages.flatMap((page) => Array.from(page ?? [])).map((v) => toNode(v, account)).filter(Boolean);
}

/**
 * The map under one spot, down to the row of 8, plus the path for the breadcrumb — one request.
 * @param {string} pkg package key
 * @param {number} rootId spot to draw at the top
 * @param {string} account wallet address, used to mark the viewer's own spots
 * @param {number|null} mainId the viewer's first spot in this package (from getUserSummary)
 * @returns {Promise<{ rootId: number, mainId: number|null, path: number[], nodes: Object<number, object> } | null>} null when the spot doesn't exist
 */
export async function getTreeView(pkg, rootId, account, mainId = null) {
    const id = Number(rootId);
    if (!Number.isInteger(id) || id <= 0) return null;

    const packageId = packageIdOf(pkg);
    // getParents stops at the top by itself, so it doesn't have to wait for the map
    const [ views, parents ] = await Promise.all([
        call(RebornMoon, "getTreeView", [ packageId, id ]),
        call(RebornMoon, "getParents", [ packageId, id, 3 ]),
    ]);

    const list = Array.from(views ?? []).map((v) => toNode(v, account));
    const root = list[0];
    if (!root) return null;

    const nodes = {};
    list.forEach((node) => {
        if (node) nodes[node.id] = node;
    });

    // The breadcrumb shows the top and the last three steps
    const path = [ ...Array.from(parents ?? [], Number).filter(Boolean).reverse(), id ];
    if (root.level > 3) path.unshift(1);

    return { rootId: id, mainId, path, nodes };
}

/**
 * USDT the wallet holds, so buttons can say "not enough" before a signature.
 * @param {string} account wallet address
 * @returns {Promise<{ balance: bigint }>}
 */
export async function getWalletFunds(account) {
    if (!isAddress(account)) return { balance: 0n };
    return { balance: BigInt(await call(Tether, "balanceOf", [ account ]) ?? 0) };
}

/**
 * Who an invite ID belongs to. Any Sector A moon ID resolves to its owner; links carry the owner's origin moon.
 * @param {number} referrerId ID from ?ref= (1 = genesis)
 * @returns {Promise<{ id: number, account: string } | null>} null when no moon has that ID
 */
export async function getRecruiter(referrerId) {
    const id = Number(referrerId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const account = await call(RebornMoon, "getReferrerOf", [ id ]);
    return isAddress(account) && !sameAddress(account, ZERO) ? { id, account } : null;
}

export { PACKAGES, isAddress, nextPackage, isUnlocked };
