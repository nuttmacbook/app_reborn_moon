// Revert strings from RebornMoon.sol mapped to words a pilot understands
const REASONS = {
    "This Account Registered": "This wallet has already launched.",
    "Cannot Self Referrer":    "You can't launch under your own beacon.",
    "Referrer Not Found":      "There's no pilot with this invite ID.",
    "Not Registered":          "Launch first, then warp.",
    "Wrong Package":           "Sectors unlock in order. Refresh the page and try again.",
    "Payment Failed":          "The USDT payment didn't go through. Check your balance and approval.",
    "No Free Seat":            "No free orbit was found this time. Please try again.",
    "No Spot In Package":      "Your recruiter has no moon in this sector yet.",
};

/** Keeps the wallet's own error code so the UI can tell a rejection from a failure */
export function normalize(error, handled, fallback) {
    const raw = handled?.raw?.reason || error?.reason || handled?.message || error?.shortMessage || error?.message || "";
    const known = Object.keys(REASONS).find((reason) => String(raw).includes(reason));
    const isRejected = error?.code === 4001 || error?.code === "ACTION_REJECTED";

    const out = new Error(known ? REASONS[known] : (isRejected ? "Rejected in wallet." : (error?.shortMessage || error?.message || fallback)));
    out.code = error?.code;
    out.cause = error;
    return out;
}
