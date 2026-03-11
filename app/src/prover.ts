/**
 * Proof Engine
 * Starknet Bitcoin Proof Layer
 *
 * Noir version:  1.0.0-beta.16
 * bb.js version: 3.0.0-nightly.20251104
 * garaga npm:    1.0.1
 */

import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import * as garaga from "garaga";
import { WalletAccount, RpcProvider } from "starknet";

// ─────────────────────────────────────────────
// Garaga WASM init (call once at app startup)
// ─────────────────────────────────────────────

let garagaReady = false;

export async function initGaraga(): Promise<void> {
  if (!garagaReady) {
    await garaga.init();
    garagaReady = true;
  }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CircuitName =
  | "balance"
  | "multi_address"
  | "historical";

export interface ProofPackage {
  proof: Uint8Array;
  publicInputs: string[];
  vk: Uint8Array;
  /** Garaga-encoded calldata ready for the Starknet verifier contract */
  starknetCalldata: bigint[];
  circuitName: CircuitName;
  generatedAt: number;
  timingMs: number;
}

export interface BalanceInputs {
  utxo_values: number[];
  salt: number[];
  threshold: string;
  commitment: string;
}

export interface MultiAddressInputs {
  utxo_values: number[][];
  address_salts: number[][];
  threshold: string;
  combined_commitment: string;
  address_count: number;
}

export interface HistoricalInputs {
  utxo_values: number[];
  utxo_block_heights: number[];
  header_versions: number[];
  header_prev_hashes: number[][];
  header_merkle_roots: number[][];
  header_times: number[];
  header_bits: number[];
  header_nonces: number[];
  salt: number[];
  threshold: string;
  since_block_height: number;
  anchor_block_hash: number[];
  commitment: string;
}

// ─────────────────────────────────────────────
// Circuit loader
// ─────────────────────────────────────────────

async function loadCircuit(name: CircuitName): Promise<{ bytecode: string; abi: object }> {
  const url = `/circuits/${name}/target/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to load circuit "${name}" from ${url}. ` +
      `Make sure circuits/target/${name}.json is copied to ` +
      `browser-engine/public/circuits/${name}/target/${name}.json`
    );
  }
  return res.json();
}

// ─────────────────────────────────────────────
// Core prove function
//
// UltraHonkBackend manages its own Barretenberg instance internally.
// At bb.js 3.0.0-nightly.20251104 the constructor signature is:
//   new UltraHonkBackend(bytecode: string, options?: BackendOptions)
// Passing a Barretenberg instance as the second arg causes
// "Unknown backend type: [object Object]" — do not do that.
// ─────────────────────────────────────────────

async function prove(
  circuitName: CircuitName,
  inputs: Record<string, unknown>,
  onProgress?: (stage: string) => void
): Promise<ProofPackage> {
  const t0 = Date.now();

  await initGaraga();

  onProgress?.("Loading circuit...");
  const circuitJson = await loadCircuit(circuitName);

  onProgress?.("Initialising Noir...");
  const noir = new Noir(circuitJson as Parameters<typeof Noir>[0]);

  onProgress?.("Generating witness...");
  const { witness } = await noir.execute(inputs);

  onProgress?.("Initialising Barretenberg...");
  // threads: 1 → single-threaded WASM, no SharedArrayBuffer, no CRS fetch
  const backend = new UltraHonkBackend(circuitJson.bytecode, { threads: 1 });
  console.log("[bb.js] UltraHonkBackend created");

  onProgress?.("Generating ZK proof...");
  // { keccakZK: true } → oracleHashType: 'keccak', disableZk: false
  // = UltraKeccakZKHonk. Matches: bb write_vk -s ultra_honk --oracle_hash keccak
  // (bb's --disable_zk defaults to false, so ZK is on by default)
  const proofData = await backend.generateProof(witness, { keccakZK: true });

  onProgress?.("Exporting verification key...");
  // Must use keccakZK: true to match the proof system used in generateProof.
  // garaga.getZKHonkCallData expects VK bytes in UltraKeccakZKHonk format.
  const vk = await backend.getVerificationKey({ keccakZK: true });

  onProgress?.("Encoding Garaga calldata for Starknet...");

  // bb.js 3.0.0-nightly.20251104: proof and publicInputs are SEPARATED
  // (confirmed from ultrahonk_backend.ts source at this exact version)
  //   proofData.proof        = Uint8Array (1888 bytes = 59 fields × 32 bytes, NO public inputs prefix)
  //   proofData.publicInputs = string[] of 0x-prefixed hex field elements
  // Garaga validates proof length independently — prepended bytes would
  // cause an immediate length mismatch error in the Rust parser.
  console.log(`[proof] bytes: ${proofData.proof.length}`);                // expect 1888
  console.log(`[proof] public inputs count: ${proofData.publicInputs.length}`); // expect 2

  // Flatten publicInputs string[] → Uint8Array (32 bytes each, big-endian)
  const publicInputsBytes = new Uint8Array(
    proofData.publicInputs.flatMap(pi => {
      const hex = pi.replace("0x", "").padStart(64, "0");
      return Array.from({ length: 32 }, (_, i) =>
        parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      );
    })
  );

  // garaga.getZKHonkCallData(proof, publicInputs, vk) → bigint[]
  // Add detailed logging to diagnose VK/proof format issues
  console.log('[garaga] proof bytes:', proofData.proof.length);
  console.log('[garaga] vk bytes:', vk.length);
  console.log('[garaga] publicInputsBytes length:', publicInputsBytes.length);
  console.log('[garaga] vk first 16 bytes:', Array.from(vk.slice(0,16)).map(b=>b.toString(16).padStart(2,"0")).join(" "));
  console.log('[garaga] proof first 16 bytes:', Array.from(proofData.proof.slice(0,16)).map(b=>b.toString(16).padStart(2,"0")).join(" "));
  const starknetCalldata = garaga.getZKHonkCallData(
    proofData.proof,
    publicInputsBytes,
    vk
  );
  console.log('[garaga] calldata length:', starknetCalldata.length);
  console.log('[garaga] calldata[0] (span_len):', starknetCalldata[0].toString());
  // calldata[1] and [2] are public inputs (threshold and commitment)
  console.log('[garaga] calldata[1] (PI[0] threshold):', "0x" + starknetCalldata[1].toString(16));
  console.log('[garaga] calldata[2] (PI[1] commitment):', "0x" + starknetCalldata[2].toString(16));

  return {
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
    vk,
    starknetCalldata,
    circuitName,
    generatedAt: Date.now(),
    timingMs: Date.now() - t0,
  };
}

// ─────────────────────────────────────────────
// Local verify (before sending to Starknet)
// ─────────────────────────────────────────────

export async function verifyProof(pkg: ProofPackage): Promise<boolean> {
  const circuitJson = await loadCircuit(pkg.circuitName);
  const backend = new UltraHonkBackend(circuitJson.bytecode, { threads: 1 });
  return backend.verifyProof({
    proof: pkg.proof,
    publicInputs: pkg.publicInputs,
    verificationKey: pkg.vk,
  }, { keccakZK: true });
}

// ─────────────────────────────────────────────
// Circuit-specific prove functions
// ─────────────────────────────────────────────

export async function proveBalance(
  inputs: BalanceInputs,
  onProgress?: (s: string) => void
): Promise<ProofPackage> {
  return prove("balance", {
    utxo_values: inputs.utxo_values.map(String),
    salt: inputs.salt,
    threshold: inputs.threshold,
    commitment: inputs.commitment,
  }, onProgress);
}

export async function proveMultiAddress(
  inputs: MultiAddressInputs,
  onProgress?: (s: string) => void
): Promise<ProofPackage> {
  return prove("multi_address", {
    utxo_values: inputs.utxo_values.map(row => row.map(String)),
    address_salts: inputs.address_salts,
    threshold: inputs.threshold,
    combined_commitment: inputs.combined_commitment,
    address_count: inputs.address_count,
  }, onProgress);
}

export async function proveHistorical(
  inputs: HistoricalInputs,
  onProgress?: (s: string) => void
): Promise<ProofPackage> {
  return prove("historical", {
    utxo_values: inputs.utxo_values.map(String),
    utxo_block_heights: inputs.utxo_block_heights,
    header_versions: inputs.header_versions,
    header_prev_hashes: inputs.header_prev_hashes,
    header_merkle_roots: inputs.header_merkle_roots,
    header_times: inputs.header_times,
    header_bits: inputs.header_bits,
    header_nonces: inputs.header_nonces,
    salt: inputs.salt,
    threshold: inputs.threshold,
    since_block_height: inputs.since_block_height,
    anchor_block_hash: inputs.anchor_block_hash,
    commitment: inputs.commitment,
  }, onProgress);
}

// ─────────────────────────────────────────────
// Serialisation
// ─────────────────────────────────────────────

export function serialiseProof(pkg: ProofPackage): string {
  return JSON.stringify({
    proof: Buffer.from(pkg.proof).toString("hex"),
    publicInputs: pkg.publicInputs,
    vk: Buffer.from(pkg.vk).toString("hex"),
    starknetCalldata: pkg.starknetCalldata.map(String),
    circuitName: pkg.circuitName,
    generatedAt: pkg.generatedAt,
    timingMs: pkg.timingMs,
  });
}

export function deserialiseProof(json: string): ProofPackage {
  const obj = JSON.parse(json);
  return {
    proof: Uint8Array.from(Buffer.from(obj.proof, "hex")),
    publicInputs: obj.publicInputs,
    vk: Uint8Array.from(Buffer.from(obj.vk, "hex")),
    starknetCalldata: (obj.starknetCalldata as string[]).map(BigInt),
    circuitName: obj.circuitName as CircuitName,
    generatedAt: obj.generatedAt,
    timingMs: obj.timingMs,
  };
}

// ─────────────────────────────────────────────
// Starknet submission
// ─────────────────────────────────────────────

// Starknet Sepolia RPC endpoint
const STARKNET_RPC = "https://starknet-sepolia.public.blastapi.io/rpc/v0_8";

// Contract addresses on Starknet Sepolia
export const STARKNET_CONTRACTS = {
  router:             "0x038e89af918aecaaf75f304a33336f8aa3c3532366d01a6bdfd064103638496d",
  // Username-enabled router (deployed with verify_btc_proof + username: felt252)
  routerV2:           "0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2",
  balanceVerifier:    "0x0488037e3063230e59180cc4d02f37a2e363cf9fd77068b82aec35fc4d5ba034",
  multiVerifier:      "0x0300401397be70fe101764681e6ebfb6dea7da13c29d68c3fb065660f330e2db",
  historicalVerifier: "0x019e6d977cf438c87105ba49dff541d7442a9a22469687f3d4176bdd0fbb378c",
} as const;

// proof_type mapping for the router contract
const PROOF_TYPE: Record<CircuitName, number> = {
  balance:       0,
  multi_address: 1,
  historical:    2,
};

export interface StarknetSubmitResult {
  txHash: string;
  explorerUrl: string;
}

/**
 * Submit a proof to the BtcProofRouter contract on Starknet Sepolia.
 *
 * Uses starknet.js WalletAccount with an explicit maxFee to bypass Argent's
 * pre-submission simulation. The simulation fails for ZK verifier calls because
 * the verifier is computationally expensive and exceeds Argent's simulation
 * step budget — even though the transaction succeeds on-chain.
 *
 * Calldata format for verify_btc_proof(proof_type: u8, full_proof_with_hints: Span<felt252>):
 *   [proof_type, span_length, elem0, elem1, ...] — passed verbatim, no wallet prefix.
 */
export async function submitToStarknet(
  pkg: ProofPackage,
  onProgress?: (stage: string) => void,
  username: string = "",
  routerOverride?: string
): Promise<StarknetSubmitResult> {
  onProgress?.("Connecting to Starknet wallet...");

  const win = window as any;
  const snWallet = win['starknet_argentX'] ?? win['starknet_braavos'] ?? win.starknet;

  if (!snWallet) {
    throw new Error("No Starknet wallet found. Please install Argent X or Braavos.");
  }

  // Connect via WalletAccount — the correct starknet.js v8 API
  const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });
  const walletAccount = await WalletAccount.connect(provider, snWallet);

  const address = walletAccount.address;
  if (!address) {
    throw new Error("Wallet connected but address not found.");
  }

  console.log("[submit] wallet address:", address);
  onProgress?.("Building calldata...");

  const proofType = PROOF_TYPE[pkg.circuitName];

  // Encode username as felt252.
  // felt252 fits up to 31 ASCII bytes. We take the first 31 chars,
  // encode each byte, and pack into a single big-endian hex felt.
  // Empty username encodes as 0x0.
  function usernameToFelt(name: string): string {
    const clean = name.slice(0, 31); // felt252 max = 31 ASCII bytes
    if (!clean) return "0x0";
    let hex = "0x";
    for (let i = 0; i < clean.length; i++) {
      hex += clean.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex;
  }

  const usernameFelt = usernameToFelt(username);
  console.log("[submit] username:", JSON.stringify(username), "→ felt252:", usernameFelt);

  const routerAddress = routerOverride ?? STARKNET_CONTRACTS.router;
  const isV2 = !!routerOverride; // v2 router expects username in calldata

  // Build calldata.
  // v1: [proof_type, span_length, ...span_elements]
  // v2: [proof_type, username_felt, span_length, ...span_elements]
  const calldataFelts = pkg.starknetCalldata.map(f => "0x" + f.toString(16));
  const calldata = isV2
    ? ["0x" + proofType.toString(16), usernameFelt, ...calldataFelts]
    : ["0x" + proofType.toString(16), ...calldataFelts];

  console.log("[submit] router:", routerAddress, isV2 ? "(v2 username)" : "(v1)");
  console.log("[submit] proof_type:", proofType);
  console.log("[submit] calldata length:", calldata.length);
  console.log("[submit] calldata[0..4]:", calldata.slice(0, 4));

  onProgress?.("Sending transaction...");

  const call = {
    contractAddress: routerAddress,
    entrypoint: "verify_btc_proof",
    calldata,
  };

  console.log("[submit] executing via WalletAccount.execute");

  const invokeResponse = await walletAccount.execute([call], {
    resourceBounds: {
      l1_gas:      { max_amount: "0x0",      max_price_per_unit: "0x5d9954af1e78" },
      l2_gas:      { max_amount: "0x400000", max_price_per_unit: "0x3b9aca000"    },
      l1_data_gas: { max_amount: "0x400",    max_price_per_unit: "0x19200"        },
    },
    version: "0x3" as any,
  });

  console.log("[submit] invokeResponse:", JSON.stringify(invokeResponse));

  const txHash = invokeResponse.transaction_hash;
  const explorerUrl = `https://sepolia.voyager.online/tx/${txHash}`;

  onProgress?.(`Transaction sent: ${txHash}`);

  return { txHash, explorerUrl };
}
