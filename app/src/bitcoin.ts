/**
 * Bitcoin Data Layer
 * Starknet Bitcoin Proof Layer
 *
 * Fetches public Bitcoin blockchain data from mempool.space API.
 * All data fetched here becomes private inputs to Noir circuits.
 * No private keys ever enter this layer.
 */

const MEMPOOL_API = "https://mempool.space/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UTXO {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey?: string;
}

export interface TxOutput {
  scriptpubkey: string;
  scriptpubkey_address: string;
  value: number; // satoshis
}

export interface TxInput {
  txid: string;
  vout: number;
  prevout: TxOutput;
}

export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  vin: TxInput[];
  vout: TxOutput[];
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
  };
}

export interface BlockHeader {
  id: string;            // block hash (display order)
  height: number;
  merkle_root: string;   // display order hex
  timestamp: number;
  bits: string;          // hex string e.g. "1702b6ac"
  nonce: number;
  previousblockhash: string; // display order hex
  version: number;
}

export interface MerkleProof {
  block_height: number;
  merkle: string[];    // sibling hashes, leaf to root
  pos: number;         // position of tx in block (used to derive branch indices)
}

// ─────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`mempool.space API error ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Address UTXOs
// GET /address/{address}/utxo
// ─────────────────────────────────────────────

export async function fetchUTXOs(address: string): Promise<UTXO[]> {
  return fetchJSON<UTXO[]>(`${MEMPOOL_API}/address/${address}/utxo`);
}

// ─────────────────────────────────────────────
// Transaction
// GET /tx/{txid}
// ─────────────────────────────────────────────

export async function fetchTransaction(txid: string): Promise<Transaction> {
  return fetchJSON<Transaction>(`${MEMPOOL_API}/tx/${txid}`);
}

// ─────────────────────────────────────────────
// Block header
// GET /block/{hash}
// ─────────────────────────────────────────────

export async function fetchBlockHeader(blockHash: string): Promise<BlockHeader> {
  return fetchJSON<BlockHeader>(`${MEMPOOL_API}/block/${blockHash}`);
}

// ─────────────────────────────────────────────
// Merkle proof for a transaction in a block
// GET /tx/{txid}/merkle-proof
// ─────────────────────────────────────────────

export async function fetchMerkleProof(txid: string): Promise<MerkleProof> {
  return fetchJSON<MerkleProof>(`${MEMPOOL_API}/tx/${txid}/merkle-proof`);
}

// ─────────────────────────────────────────────
// Block hash at a given height
// GET /block-height/{height}
// ─────────────────────────────────────────────

export async function fetchBlockHashAtHeight(height: number): Promise<string> {
  const res = await fetch(`${MEMPOOL_API}/block-height/${height}`);
  if (!res.ok) throw new Error(`Failed to fetch block at height ${height}`);
  return res.text();
}

// ─────────────────────────────────────────────
// Input constructors for Noir circuits
// ─────────────────────────────────────────────

/**
 * Build private inputs for the balance_threshold circuit.
 * Pads UTXO array to MAX_UTXOS=16 with zeros.
 */
export function buildBalanceInputs(utxos: UTXO[]): {
  utxo_values: number[];
  total: number;
} {
  const MAX_UTXOS = 16;
  const values = utxos.map((u) => u.value);

  if (values.length > MAX_UTXOS) {
    throw new Error(`Too many UTXOs: ${values.length} > ${MAX_UTXOS}`);
  }

  // Pad to MAX_UTXOS with zeros
  while (values.length < MAX_UTXOS) values.push(0);

  const total = utxos.reduce((sum, u) => sum + u.value, 0);
  return { utxo_values: values, total };
}

/**
 * Convert a hex string to a Uint8Array (32 bytes).
 * Used to convert txids, block hashes, pubkeys to circuit byte arrays.
 */
export function hexToBytes(hex: string, expectedLength?: number): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error(
      `Expected ${expectedLength} bytes, got ${bytes.length} from: ${hex}`
    );
  }
  return bytes;
}

/**
 * Convert a TXID string to internal byte order (reverse of display order).
 * Bitcoin displays TXIDs in reversed byte order.
 */
export function txidToInternalBytes(txid: string): number[] {
  return hexToBytes(txid, 32).reverse();
}

/**
 * Build merkle branch and branch indices for the merkle_inclusion circuit.
 * Pads to MERKLE_DEPTH=14 with zero hashes.
 *
 * branch_indices[i] = 0 means the tx is the LEFT child at level i
 * branch_indices[i] = 1 means the tx is the RIGHT child at level i
 */
export function buildMerkleInputs(proof: MerkleProof): {
  merkle_branch: number[][];
  branch_indices: number[];
} {
  const MERKLE_DEPTH = 14;

  // mempool.space /tx/{txid}/merkle-proof returns sibling hashes in
  // DISPLAY (reversed) byte order -- must reverse to internal byte order
  // for the circuit's SHA256d computation. Confirmed by debug walk.
  const branch: number[][] = proof.merkle.map((h) => hexToBytes(h, 32).reverse());
  const indices: number[] = [];

  // Derive branch indices from tx position in block.
  // pos % 2 == 0 means this node is a LEFT child (index=0)
  // pos % 2 == 1 means this node is a RIGHT child (index=1)
  let pos = proof.pos;
  for (let i = 0; i < proof.merkle.length; i++) {
    indices.push(pos % 2);
    pos = Math.floor(pos / 2);
  }

  // Pad to MERKLE_DEPTH with zero hashes and index 0
  while (branch.length < MERKLE_DEPTH) {
    branch.push(new Array(32).fill(0));
    indices.push(0);
  }

  return { merkle_branch: branch, branch_indices: indices };
}

/**
 * Generate a cryptographically random 32-byte salt.
 * Used to blind commitments and prevent proof replay.
 */
export function generateSalt(): number[] {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return Array.from(salt);
}
