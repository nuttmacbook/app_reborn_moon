// USDT on BSC mainnet (18 decimals) — the same address RebornMoon.sol charges and pays in
export const Tether = {
    address: "0x55d398326f99059fF775485246999027B3197955",
    abi: [
        { type: "function", name: "allowance", stateMutability: "view",       inputs: [ { name: "owner", type: "address" }, { name: "spender", type: "address" } ], outputs: [ { name: "", type: "uint256" } ] },
        { type: "function", name: "approve",   stateMutability: "nonpayable", inputs: [ { name: "spender", type: "address" }, { name: "amount", type: "uint256" } ],  outputs: [ { name: "", type: "bool" } ] },
        { type: "function", name: "balanceOf", stateMutability: "view",       inputs: [ { name: "account", type: "address" } ],                                         outputs: [ { name: "", type: "uint256" } ] },
    ],
};
