/**
 * Starknet Bitcoin Proof Layer -- Browser Engine
 * Public API
 *
 * Noir 1.0.0-beta.16 | bb.js 3.0.0-nightly | Garaga 1.0.1
 */

// High-level orchestrated flows
export {
  generateBalanceProof,
  type ProofResult,
} from "./orchestrator";

// Multi-address + historical flows
export {
  generateMultiAddressProof,
  generateHistoricalProof,
} from "./new_flows";

// Low-level prover + Garaga init
export {
  initGaraga,
  proveBalance,
  proveMultiAddress,
  proveHistorical,
  verifyProof,
  serialiseProof,
  deserialiseProof,
  type ProofPackage,
  type CircuitName,
  type BalanceInputs,
  type MultiAddressInputs,
  type HistoricalInputs,
} from "./prover";

// Bitcoin data utilities
export {
  fetchUTXOs,
  fetchTransaction,
  fetchBlockHeader,
  fetchBlockHashAtHeight,
  buildBalanceInputs,
  generateSalt,
  hexToBytes,
  txidToInternalBytes,
  type UTXO,
  type Transaction,
  type BlockHeader,
} from "./bitcoin";
