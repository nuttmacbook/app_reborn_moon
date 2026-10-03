// Multicall3 — the same address on BSC and most EVM chains (https://www.multicall3.com)
export const Multicall3 = {
    address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    abi: [
        {
            type: "function",
            name: "aggregate3",
            stateMutability: "payable",
            inputs: [ { name: "calls", type: "tuple[]", components: [
                { name: "target", type: "address" },
                { name: "allowFailure", type: "bool" },
                { name: "callData", type: "bytes" },
            ] } ],
            outputs: [ { name: "returnData", type: "tuple[]", components: [
                { name: "success", type: "bool" },
                { name: "returnData", type: "bytes" },
            ] } ],
        },
    ],
};
