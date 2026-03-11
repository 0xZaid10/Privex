/**
 * Proof Orchestrator — Balance Flow
 * Starknet Bitcoin Proof Layer
 *
 * Noir 1.0.0-beta.16 | bb.js 3.0.0-nightly.20251104 | Garaga 1.0.1
 *
 * COMMITMENT STRATEGY:
 * Commitments are computed by executing tiny headless Noir circuits
 * (balance_commit / multi_commit / historical_commit) via noir_js.
 * noir.execute() returns the witness + return value; no proof needed.
 *
 * All commit circuits take the SAME raw input types as their corresponding
 * main circuits — no pre-packing of salts or values on the JS side.
 * The circuits handle all Field packing internally.
 */

import { fetchUTXOs, buildBalanceInputs, generateSalt } from "./bitcoin";
import { proveBalance, verifyProof, serialiseProof, type ProofPackage } from "./prover";
import { Noir } from "@noir-lang/noir_js";

// ─────────────────────────────────────────────
// Commitment helpers
// ─────────────────────────────────────────────

/** Load a circuit JSON from /circuits/<n>/target/<n>.json */
async function loadCircuit(name: string): Promise<any> {
  const res = await fetch(`/circuits/${name}/target/${name}.json`);
  if (!res.ok) throw new Error(`Failed to load commit circuit ${name}: ${res.status}`);
  return res.json();
}

/** Convert a number to a Noir u64/u32 decimal string */
function toUint(n: number): string {
  return n.toString(10);
}

/**
 * Compute balance commitment via headless noir.execute()
 *
 * balance_commit circuit signature:
 *   fn main(utxo_values: [u64; 16], salt: [u8; 32]) -> pub Field
 *
 * Matches balance/main.nr exactly:
 *   - utxo_values passed as decimal strings (Noir u64)
 *   - salt passed as number[] (Noir [u8; 32])
 *   - circuit packs salt bytes 0..31 into a Field internally
 */
export async function computeBalanceCommitment(
  utxoValues: number[],  // 16 elements, padded with 0
  salt: number[]         // 32 bytes from generateSalt()
): Promise<string> {
  const circuit = await loadCircuit("balance_commit");
  const noir = new Noir(circuit);
  const { returnValue } = await noir.execute({
    utxo_values: utxoValues.map(toUint),  // [u64; 16] as decimal strings
    salt: salt,                            // [u8; 32] as number[]
  });
  return (returnValue as string).toString();
}

/**
 * Compute multi-address commitment via headless noir.execute()
 *
 * multi_commit circuit signature:
 *   fn main(utxo_values: [[u64; 8]; 8], salts: [[u8; 31]; 8]) -> pub Field
 *
 * Matches multi_address/main.nr exactly:
 *   - utxo_values passed as decimal strings (Noir u64)
 *   - salts passed as raw number[][] (Noir [[u8; 31]; 8])
 *   - circuit packs each salt's 31 bytes into a Field internally
 */
export async function computeMultiAddressCommitment(
  allValues: number[][],  // [8][8], inactive rows are all-zero
  salts: number[][]       // [8][31], inactive rows are all-zero
): Promise<string> {
  const circuit = await loadCircuit("multi_commit");
  const noir = new Noir(circuit);
  const { returnValue } = await noir.execute({
    utxo_values: allValues.map(row => row.map(toUint)),  // [[u64; 8]; 8]
    salts: salts,                                         // [[u8; 31]; 8] as number[][]
  });
  return (returnValue as string).toString();
}

/**
 * Compute historical commitment via headless noir.execute()
 *
 * historical_commit circuit signature:
 *   fn main(
 *     utxo_values:  [u64; 16],
 *     utxo_heights: [u32; 16],
 *     header_times: [u32; 8],
 *     salt:         [u8; 31]
 *   ) -> pub Field
 *
 * Matches historical/main.nr exactly — no pre-packing on the JS side.
 */
export async function computeHistoricalCommitment(
  utxoValues: number[],   // 16 elements, padded with 0
  utxoHeights: number[],  // 16 elements, padded with 0
  headerTimes: number[],  // 8 elements
  salt: number[]          // 31 bytes
): Promise<string> {
  const circuit = await loadCircuit("historical_commit");
  const noir = new Noir(circuit);
  const { returnValue } = await noir.execute({
    utxo_values:  utxoValues.map(toUint),   // [u64; 16] as decimal strings
    utxo_heights: utxoHeights.map(toUint),  // [u32; 16] as decimal strings
    header_times: headerTimes.map(toUint),  // [u32; 8] as decimal strings
    salt: salt,                              // [u8; 31] as number[]
  });
  return (returnValue as string).toString();
}

// ─────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────

export interface ProofResult {
  package: ProofPackage;
  verified: boolean;
  serialised: string;
  timingMs: number;
}

// ─────────────────────────────────────────────
// Balance proof flow
// ─────────────────────────────────────────────

export async function generateBalanceProof(
  address: string,
  threshold: number,
  onProgress?: (stage: string) => void
): Promise<ProofResult> {
  const t0 = Date.now();

  onProgress?.("Fetching UTXOs from mempool.space...");
  const utxos = await fetchUTXOs(address);
  if (utxos.length === 0) throw new Error(`No UTXOs found for: ${address}`);

  const { utxo_values, total } = buildBalanceInputs(utxos);
  if (total < threshold) {
    throw new Error(`Insufficient balance: ${total} < ${threshold} satoshis`);
  }

  onProgress?.("Generating salt...");
  // generateSalt() returns 32 bytes — matches balance circuit's [u8; 32]
  const salt = generateSalt();

  onProgress?.("Computing commitment...");
  const commitment = await computeBalanceCommitment(utxo_values, salt);

  const pkg = await proveBalance(
    { utxo_values, salt, threshold: threshold.toString(), commitment },
    onProgress
  );

  onProgress?.("Verifying proof locally...");
  const verified = await verifyProof(pkg);

  return { package: pkg, verified, serialised: serialiseProof(pkg), timingMs: Date.now() - t0 };
}
