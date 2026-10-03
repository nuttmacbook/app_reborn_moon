import { EXPLORER } from "../web3/connect";
import { escapeHtml } from "./ui";

const STEPS = {
    checking:  { title: "Pre-flight check", desc: "Making sure your wallet holds enough USDT before anything is signed." },
    approve:   { title: "Approve USDT",     desc: "Confirm in your wallet so Reborn Moon can take the sector price." },
    approving: { title: "Approving USDT",   desc: "Waiting for the approval to be confirmed on-chain." },
    create:    { title: "Confirm launch",   desc: "Confirm the launch transaction in your wallet." },
    creating:  { title: "Launching",        desc: "Waiting for the block. Your first moon appears once it's confirmed." },
    upgrade:   { title: "Confirm warp",     desc: "Confirm the warp upgrade in your wallet." },
    upgrading: { title: "Warping",          desc: "Waiting for the block. The new sector unlocks once it's confirmed." },
};

let hideTimer = null;

/** Lives outside #app so a full repaint doesn't wipe a pending message */
const toastRoot = () => {
    let el = document.querySelector("[data-toast]");
    if (el) return el;
    el = document.createElement("div");
    el.dataset.toast = "";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.className = "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]";
    document.body.appendChild(el);
    return el;
};

const show = ({ tone, title, desc, extra = "", isBusy = false, autoHide = 0 }) => {
    const ring = { busy: "ring-sky-300/35", good: "ring-beam/60", bad: "ring-rose-400/50" }[tone];
    const glow = { busy: "rgb(56_189_248/0.4)", good: "rgb(103_232_249/0.6)", bad: "rgb(244_63_94/0.35)" }[tone];

    toastRoot().innerHTML = /*html*/`
        <div class="pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-3 rounded-2xl bg-deck/95 p-4 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.85),0_0_30px_-8px_${glow}] ring-1 ring-inset ${ring} backdrop-blur motion-reduce:animate-none">
            ${isBusy
                ? `<span class="relative mt-0.5 h-5 w-5 shrink-0" aria-hidden="true"><span class="absolute inset-0 animate-spin rounded-full border-2 border-sky-300/25 border-t-beam motion-reduce:animate-none"></span><span class="absolute inset-[6px] rounded-full bg-white shadow-[0_0_8px_#67e8f9]"></span></span>`
                : `<span class="mt-1 h-3 w-3 shrink-0 rounded-full ${tone === "good" ? "bg-beam shadow-[0_0_10px_#67e8f9]" : "bg-rose-400"}" aria-hidden="true"></span>`}
            <div class="min-w-0 flex-1">
                <p class="font-display text-base font-bold tracking-wide text-ice">${title}</p>
                <p class="text-sm text-sky-100/85">${desc}</p>
                ${extra}
            </div>
            ${isBusy ? "" : `<button type="button" onclick="this.closest('[data-toast]').innerHTML = ''" class="shrink-0 rounded-lg px-1 text-sky-300 hover:text-ice" aria-label="Close">✕</button>`}
        </div>
    `;
    clearTimeout(hideTimer);
    if (autoHide > 0) hideTimer = setTimeout(() => { toastRoot().innerHTML = ""; }, autoHide);
};

const notify = {
    pending: ({ stage, index = 0, total = 0 } = {}) => {
        const step = STEPS[stage] ?? STEPS.checking;
        const counter = total > 0 && index > 0 ? `<p class="mt-1 text-xs font-semibold text-sky-300/70">Wallet step ${index} of ${total}</p>` : "";
        show({ tone: "busy", isBusy: true, title: step.title, desc: step.desc, extra: counter });
    },

    success: ({ hash, title = "Launch complete", desc = "Your first moon is in orbit. Loading your map." } = {}) => {
        const link = hash && EXPLORER ? `<a href="${EXPLORER}/tx/${hash}" target="_blank" rel="noopener" class="mt-1 inline-block text-xs font-semibold text-beam underline underline-offset-2">View transaction</a>` : "";
        show({ tone: "good", title, desc, extra: link, autoHide: 8000 });
    },

    error: (err, { title = "Launch failed", retry = "Launch" } = {}) => {
        // 4001 / ACTION_REJECTED is the wallet's "user said no"
        const isRejected = err?.code === 4001 || err?.code === "ACTION_REJECTED" || /reject|denied/i.test(err?.message ?? "");
        show({
            tone: "bad",
            title: isRejected ? "Cancelled in your wallet" : title,
            desc: isRejected ? `Nothing was sent. Press ${retry} again when you're ready.` : escapeHtml(err?.message ?? "Something went wrong. Please try again."),
            autoHide: 10000,
        });
    },
};

export { notify };
