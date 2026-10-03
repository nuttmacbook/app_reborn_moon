import { PLAN_CHAIN, isPlanChain } from "../web3/connect";
import { SOFT_BTN, addressLabel } from "./ui";

const crescent = /*html*/`
    <img src="/logo.png" alt="" width="32" height="32" class="h-8 w-8 drop-shadow-[0_0_8px_rgb(56_189_248/0.6)]" />
`;

const topBar = ({ account }) => /*html*/`
    <header class="sticky top-0 z-20 border-b border-sky-300/10 bg-space/75 backdrop-blur-md">
        <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <span class="flex min-w-0 items-center gap-2">
                ${crescent}
                <span class="truncate bg-gradient-to-r from-white to-sky-300 bg-clip-text font-display text-lg font-extrabold tracking-[0.04em] text-transparent sm:text-xl sm:tracking-[0.08em]">Reborn Moon</span>
            </span>

            ${account && !isPlanChain() ? /*html*/`
                <button type="button" onclick="switchNetwork()"
                    class="${SOFT_BTN} rounded-full bg-rose-500/15 text-rose-100 ring-rose-400/40 hover:bg-rose-500/25">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-rose-400 motion-reduce:animate-none"></span>
                    Switch to ${PLAN_CHAIN?.name ?? "the right network"}
                </button>
            ` : account ? /*html*/`
                <button type="button" onclick="openWallet()" aria-label="Wallet ${addressLabel(account)}"
                    class="${SOFT_BTN} rounded-full pl-2.5 font-mono text-xs tabular-nums">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-beam shadow-[0_0_8px_rgb(103_232_249/0.9)] motion-reduce:animate-none"></span>
                    ${addressLabel(account)}
                </button>
            ` : /*html*/`
                <button type="button" onclick="connectWallet()" class="${SOFT_BTN} rounded-full">Connect wallet</button>
            `}
        </div>
    </header>
`;

export { topBar };
