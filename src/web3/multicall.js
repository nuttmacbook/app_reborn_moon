import { box, etherjs, READ_RPC } from "./connect";
import { Multicall3 } from "./contracts/contract_multicall";

// Every read in the app goes through call(). Reads started in the same moment — a screen loading,
// a Promise.all — are collected and sent to the chain as one Multicall3 request.

const MAX_PER_REQUEST = 100;   // keeps one eth_call well under RPC gas caps; bigger batches are split

let pending = [];
let isScheduled = false;
let multicallReader = null;
const interfaces = new Map();

const interfaceOf = (contract) => {
    if (!interfaces.has(contract.address)) interfaces.set(contract.address, new etherjs.Interface(contract.abi));
    return interfaces.get(contract.address);
};

/** A failed call carries the contract's revert reason when there is one */
const revertError = (method, data) => {
    try {
        const [ reason ] = etherjs.AbiCoder.defaultAbiCoder().decode([ "string" ], `0x${String(data).slice(10)}`);
        return new Error(`${method}: ${reason}`);
    } catch {
        return new Error(`${method} reverted`);
    }
};

async function send(batch) {
    try {
        multicallReader ??= box.createWeb3Contract(Multicall3, READ_RPC);
        const results = await multicallReader.methods
            .aggregate3(batch.map((job) => ({ target: job.target, allowFailure: true, callData: job.data })))
            .call();

        // One failing read doesn't take the others down with it
        results.forEach((result, i) => {
            const job = batch[i];
            const isSuccess = result.success ?? result[0];
            const data = result.returnData ?? result[1];
            if (!isSuccess) return job.reject(revertError(job.method, data));
            try {
                const decoded = job.iface.decodeFunctionResult(job.method, data);
                job.resolve(decoded.length === 1 ? decoded[0] : decoded);
            } catch (err) {
                job.reject(err);
            }
        });
    } catch (err) {
        batch.forEach((job) => job.reject(err));
    }
}

function flush() {
    const batch = pending;
    pending = [];
    isScheduled = false;
    for (let i = 0; i < batch.length; i += MAX_PER_REQUEST) send(batch.slice(i, i + MAX_PER_REQUEST));
}

/**
 * Reads one view function. Calls made together are batched into a single request.
 * @param {{ address: string, abi: object[] }} contract
 * @param {string} method view function name
 * @param {Array} [args]
 * @returns {Promise<any>} the decoded value; several return values come back as a list (also readable by name)
 */
export function call(contract, method, args = []) {
    return new Promise((resolve, reject) => {
        const iface = interfaceOf(contract);
        pending.push({ target: contract.address, data: iface.encodeFunctionData(method, args), iface, method, resolve, reject });
        if (!isScheduled) {
            isScheduled = true;
            setTimeout(flush, 0);   // wait one tick so everything started together joins this request
        }
    });
}
