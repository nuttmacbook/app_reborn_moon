import { kitbox, chain, utils, etherjs } from "kitbox";

// The plan lives on BSC mainnet: RebornMoon.sol charges and pays in BSC USDT
const PLAN_CHAIN = chain.bsc;

// Reads always go to the plan's chain, even when the wallet sits on another network
const READ_RPC = PLAN_CHAIN?.rpcUrls?.default?.http?.[0] ?? "";

const EXPLORER = PLAN_CHAIN?.blockExplorers?.default?.url ?? "";

const box = new kitbox();

// Reown (WalletConnect) project id; .env can override it
const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || "30c39054b2e2c8137bfe688af324e067";

const modal = box.createModal(PROJECT_ID, [ PLAN_CHAIN ], "dark", {
    "--w3m-accent": "#38bdf8",
    "--w3m-border-radius-master": "4px",
});

const { shortAddress, formNumber, timestampToUTC, delay } = utils;

/** True when the wallet is on the plan's chain; signing on any other chain would send to the wrong place */
const isPlanChain = () => Number(box.store?.networkState?.chainId ?? 0) === Number(PLAN_CHAIN?.id ?? -1);

/** Asks the wallet to move to the plan's chain */
const switchToPlanChain = () => modal?.switchNetwork?.(PLAN_CHAIN);

export {
    box, modal, chain, etherjs, PLAN_CHAIN, READ_RPC, EXPLORER,
    isPlanChain, switchToPlanChain, shortAddress, formNumber, timestampToUTC, delay,
};
