import { box, PLAN_CHAIN, isPlanChain } from "../connect";
import { RebornMoon } from "../contracts/contract_plan";
import { Tether } from "../contracts/contract_tether";
import { call } from "../multicall";
import { normalize } from "./errors";

/**
 * Joins the plan with the first package (A), approving USDT first when needed.
 * Later packages open through upgrade(), never here.
 *
 * @param {object} wallet    current wallet state
 * @param {{ id: number, price: bigint }} pkg  PACKAGES[0] — only its price is used; the contract always starts at package 1
 * @param {number} referrerId  invite ID from the link (a Sector A moon ID; 1 = genesis)
 * @param {object} options
 * @param {(step: {stage: string, index: number, total: number}) => void} options.onStep
 *        called before each wallet prompt so the UI can say what is being signed
 * @returns {Promise<object>} the transaction receipt
 */
export async function register(wallet, pkg, referrerId, { onStep = () => {} } = {}) {
    const account = wallet?.address ?? box.ZERO;
    const signer = wallet?.signer;
    const AMOUNT = pkg?.priceWei ?? BigInt(pkg?.price ?? 0n) * 10n ** 18n; // priceWei comes from priceOf() on the contract

    if (!account || account === box.ZERO || !signer) {
        throw new Error("Wallet is not connected.");
    }
    if (!Number.isInteger(Number(referrerId)) || Number(referrerId) <= 0) {
        throw new Error("This link has no valid recruiter ID.");
    }
    if (AMOUNT <= 0n) {
        throw new Error("Pick a sector first.");
    }
    if (!RebornMoon.address) {
        throw new Error("The plan contract address isn't set yet.");
    }
    if (!isPlanChain()) {
        throw new Error(`Switch your wallet to ${PLAN_CHAIN?.name ?? "the plan's network"} first.`);
    }

    onStep({ stage: "checking", index: 0, total: 1 });

    // Everything checked before a signature, read in one request.
    // The contract would revert on these, but a clear message beats a failed signature.
    const [ isMember, referrer, allowance, balance ] = await Promise.all([
        call(RebornMoon, "isRegistered", [ account ]),
        call(RebornMoon, "getReferrerOf", [ referrerId ]),
        call(Tether, "allowance", [ account, RebornMoon.address ]),
        call(Tether, "balanceOf", [ account ]),
    ]);
    if (isMember) throw new Error("This wallet has already launched.");
    if (!referrer || /^0x0{40}$/i.test(referrer)) throw new Error(`There's no pilot with ID #${referrerId}.`);
    if (String(referrer).toLowerCase() === account.toLowerCase()) throw new Error("You can't launch under your own beacon.");
    if (BigInt(balance) < AMOUNT) throw new Error("Not enough USDT in your wallet.");

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

    onStep({ stage: "create", index: total, total });
    try {
        const plan = box.createEtherContract(RebornMoon, signer);
        const tx = await plan.register(referrerId);
        onStep({ stage: "creating", index: total, total });
        return await tx.wait();
    } catch (error) {
        const handled = box.handleTxError(RebornMoon, error);
        throw normalize(error, handled, "The launch transaction did not go through.");
    }
}
