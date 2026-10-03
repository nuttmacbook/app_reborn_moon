import { box, PLAN_CHAIN, isPlanChain } from "../connect";
import { RebornMoon } from "../contracts/contract_plan";
import { Tether } from "../contracts/contract_tether";
import { call } from "../multicall";
import { normalize } from "./errors";

/**
 * Upgrades the account to the next package, approving USDT first when needed.
 * Packages open in order (A → B → C), so `pkg` must be the one right after the highest unlocked.
 *
 * @param {object} wallet  current wallet state
 * @param {{ id: number, price: bigint }} pkg  next package from PACKAGES (price in whole USDT)
 * @param {object} options
 * @param {(step: {stage: string, index: number, total: number}) => void} options.onStep
 *        called before each wallet prompt so the UI can say what is being signed
 * @returns {Promise<object>} the transaction receipt
 */
export async function upgrade(wallet, pkg, { onStep = () => {} } = {}) {
    const account = wallet?.address ?? box.ZERO;
    const signer = wallet?.signer;
    const AMOUNT = pkg?.priceWei ?? BigInt(pkg?.price ?? 0n) * 10n ** 18n; // priceWei comes from priceOf() on the contract

    if (!account || account === box.ZERO || !signer) {
        throw new Error("Wallet is not connected.");
    }
    if (!pkg || AMOUNT <= 0n) {
        throw new Error("Every sector is already unlocked.");
    }
    if (!RebornMoon.address) {
        throw new Error("The plan contract address isn't set yet.");
    }
    if (!isPlanChain()) {
        throw new Error(`Switch your wallet to ${PLAN_CHAIN?.name ?? "the plan's network"} first.`);
    }

    onStep({ stage: "checking", index: 0, total: 1 });

    // Everything checked before a signature, read in one request
    const [ info, allowance, balance ] = await Promise.all([
        call(RebornMoon, "getUserInfo", [ account ]),
        call(Tether, "allowance", [ account, RebornMoon.address ]),
        call(Tether, "balanceOf", [ account ]),
    ]);
    const unlocked = Number(info?.unlocked ?? info?.[2] ?? 0);
    if (unlocked === 0) throw new Error("Launch first, then warp.");
    if (Number(pkg.id) !== unlocked + 1) throw new Error("Sectors unlock in order. Refresh the page and try again.");
    if (BigInt(balance) < AMOUNT) throw new Error(`Not enough USDT in your wallet. This warp costs ${pkg.price} USDT.`);

    // Two wallet prompts when approval is still needed, one when it is not
    const isApproved = BigInt(allowance) >= AMOUNT;
    const total = isApproved ? 1 : 2;

    if (!isApproved) {
        onStep({ stage: "approve", index: 1, total });
        try {
            const token = box.createEtherContract(Tether, signer);
            const tx = await token.approve(RebornMoon.address, AMOUNT);
            onStep({ stage: "approving", index: 1, total });
            await tx.wait();
        } catch (error) {
            const handled = box.handleTxError(Tether, error);
            throw normalize(error, handled, "Approval failed. Please try again.");
        }
    }

    onStep({ stage: "upgrade", index: total, total });
    try {
        const plan = box.createEtherContract(RebornMoon, signer);
        const tx = await plan.upgrade(pkg.id);
        onStep({ stage: "upgrading", index: total, total });
        return await tx.wait();
    } catch (error) {
        const handled = box.handleTxError(RebornMoon, error);
        throw normalize(error, handled, "The warp transaction did not go through.");
    }
}
