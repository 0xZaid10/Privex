/**
 * New Proof Flows — Multi-Address + Historical
 * Starknet Bitcoin Proof Layer
 *
 * Noir 1.0.0-beta.16 | bb.js 3.0.0-nightly.20251104 | Garaga 1.0.1
 *
 * Commitments computed via headless noir.execute() on tiny commit circuits.
 */

import {
  fetchUTXOs,
  fetchBlockHeader,
  fetchBlockHashAtHeight,
  hexToBytes,
} from "./bitcoin";

import { proveMultiAddress, proveHistorical, verifyProof, serialiseProof } from "./prover";
import {
  computeMultiAddressCommitment,
  computeHistoricalCommitment,
  type ProofResult,
} from "./orchestrator";

// ─────────────────────────────────────────────
// Multi-address proof flow
// ─────────────────────────────────────────────

export async function generateMultiAddressProof(
  addresses: string[],
  threshold: number,
  onProgress?: (stage: string) => void
): Promise<ProofResult> {
  const t0 = Date.now();

  if (addresses.length === 0 || addresses.length > 8) {
    throw new Error("Must provide 1-8 addresses");
  }

  // multi_address circuit: MAX_ADDRESSES=8, MAX_UTXOS_PER=8
  // allValues[i][j] = j-th UTXO value of i-th address (0 for inactive slots)
  const MAX_UTXOS_PER = 8;
  const allValues: number[][] = Array.from({ length: 8 }, () => new Array(MAX_UTXOS_PER).fill(0));
  let combinedTotal = 0;

  for (let i = 0; i < addresses.length; i++) {
    onProgress?.(`Fetching UTXOs for address ${i + 1}/${addresses.length}...`);
    let utxos = await fetchUTXOs(addresses[i]);

    if (utxos.length > MAX_UTXOS_PER) {
      // Circuit is limited to MAX_UTXOS_PER slots per address.
      // Take the top MAX_UTXOS_PER UTXOs by value to maximise the
      // provable balance. Remaining UTXOs are excluded from the proof
      // but the user can still meet the threshold with the largest ones.
      console.warn(
        `[multi_address] Address ${i + 1} has ${utxos.length} UTXOs, ` +
        `selecting top ${MAX_UTXOS_PER} by value (circuit limit).`
      );
      utxos = utxos
        .slice()
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_UTXOS_PER);
    }

    // Fill in actual UTXO values; remaining slots stay 0
    for (let j = 0; j < utxos.length; j++) {
      allValues[i][j] = utxos[j].value;
    }
    combinedTotal += utxos.reduce((s, u) => s + u.value, 0);
  }

  if (combinedTotal < threshold) {
    throw new Error(`Combined balance ${combinedTotal} < threshold ${threshold} satoshis`);
  }

  onProgress?.("Generating salts...");
  // Active addresses get a random 31-byte salt.
  // Inactive addresses MUST have all-zero salts — the fixed circuit asserts this.
  const salts: number[][] = Array.from({ length: 8 }, (_, i) => {
    if (i < addresses.length) {
      const salt = new Uint8Array(31);
      crypto.getRandomValues(salt);
      return Array.from(salt);
    }
    return new Array(31).fill(0);  // inactive slot — must be zero
  });

  onProgress?.("Computing commitment...");
  const commitment = await computeMultiAddressCommitment(allValues, salts);

  const pkg = await proveMultiAddress(
    {
      utxo_values: allValues,
      address_salts: salts,
      threshold: threshold.toString(),
      combined_commitment: commitment,
      address_count: addresses.length,
    },
    onProgress
  );

  onProgress?.("Verifying proof locally...");
  const verified = await verifyProof(pkg);

  return { package: pkg, verified, serialised: serialiseProof(pkg), timingMs: Date.now() - t0 };
}

// ─────────────────────────────────────────────
// Historical proof flow
// ─────────────────────────────────────────────

export async function generateHistoricalProof(
  address: string,
  threshold: number,
  sinceHeight: number,
  onProgress?: (stage: string) => void
): Promise<ProofResult> {
  const t0 = Date.now();

  onProgress?.("Fetching UTXOs...");
  const utxos = await fetchUTXOs(address);

  const historicalUtxos = utxos.filter(
    (u: any) => u.status?.block_height && u.status.block_height <= sinceHeight
  );

  if (historicalUtxos.length === 0) {
    throw new Error(`No UTXOs confirmed at or before block ${sinceHeight}`);
  }

  const historicalTotal = historicalUtxos.reduce((s: number, u: any) => s + u.value, 0);
  if (historicalTotal < threshold) {
    throw new Error(
      `Historical balance ${historicalTotal} sats < threshold ${threshold} sats at block ${sinceHeight}`
    );
  }

  const paddedValues: number[] = new Array(16).fill(0);
  const paddedHeights: number[] = new Array(16).fill(0);
  for (let i = 0; i < Math.min(historicalUtxos.length, 16); i++) {
    paddedValues[i]  = (historicalUtxos[i] as any).value;
    paddedHeights[i] = (historicalUtxos[i] as any).status.block_height;
  }

  const HEADER_DEPTH = 8;
  const headerVersions:    number[]   = [];
  const headerPrevHashes:  number[][] = [];
  const headerMerkleRoots: number[][] = [];
  const headerTimes:       number[]   = [];
  const headerBits:        number[]   = [];
  const headerNonces:      number[]   = [];

  for (let i = 0; i < HEADER_DEPTH; i++) {
    onProgress?.(`Fetching block header ${i + 1}/${HEADER_DEPTH}...`);
    const blockHash = await fetchBlockHashAtHeight(sinceHeight + i);
    const header    = await fetchBlockHeader(blockHash);

    headerVersions.push(header.version ?? 1);
    const prevHash = header.previousblockhash ?? "00".repeat(32);
    headerPrevHashes.push(hexToBytes(prevHash, 32).reverse());
    headerMerkleRoots.push(hexToBytes(header.merkle_root, 32).reverse());
    headerTimes.push(header.timestamp);
    const bitsNum = typeof header.bits === "string"
      ? parseInt(header.bits as string, 16)
      : (header.bits as number) ?? 0;
    headerBits.push(bitsNum);
    headerNonces.push(header.nonce ?? 0);
  }

  const anchorHashHex   = await fetchBlockHashAtHeight(sinceHeight + HEADER_DEPTH - 1);
  const anchorBlockHash = hexToBytes(anchorHashHex, 32).reverse();

  onProgress?.("Generating salt...");
  // historical circuit uses [u8; 31] salt
  const saltArr = new Uint8Array(31);
  crypto.getRandomValues(saltArr);
  const salt = Array.from(saltArr);

  onProgress?.("Computing historical commitment...");
  const commitment = await computeHistoricalCommitment(
    paddedValues, paddedHeights, headerTimes, salt
  );

  const pkg = await proveHistorical(
    {
      utxo_values:         paddedValues,
      utxo_block_heights:  paddedHeights,
      header_versions:     headerVersions,
      header_prev_hashes:  headerPrevHashes,
      header_merkle_roots: headerMerkleRoots,
      header_times:        headerTimes,
      header_bits:         headerBits,
      header_nonces:       headerNonces,
      salt,
      threshold:           threshold.toString(),
      since_block_height:  sinceHeight,
      anchor_block_hash:   anchorBlockHash,
      commitment,
    },
    onProgress
  );

  onProgress?.("Verifying proof locally...");
  const verified = await verifyProof(pkg);

  return { package: pkg, verified, serialised: serialiseProof(pkg), timingMs: Date.now() - t0 };
}
