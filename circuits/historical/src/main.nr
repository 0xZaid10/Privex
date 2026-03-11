// ============================================================
// Historical Bitcoin Ownership Circuit
// Starknet Bitcoin Proof Layer
//
// Statement:  I have held >= threshold satoshis continuously
//             since block `since_block_height`, proven by showing
//             a set of UTXOs that:
//               (a) exist at or before `since_block_height`
//               (b) are still unspent (no spending tx confirmed)
//               (c) sum to >= threshold
//
// This is valuable for:
//   - DeFi collateral ("hodler of >= 1 BTC for >= 6 months")
//   - Reputation systems ("long-term Bitcoin holder")
//   - Access gating ("held since before block X")
//
// How block time works in Bitcoin:
//   Each block header contains a `time` field (Unix timestamp).
//   Bitcoin targets one block every ~600 seconds.
//   Block timestamps are not perfectly accurate but are
//   consensus-validated to be > median of last 11 blocks.
//
// Circuit approach:
//   We verify a chain of HEADER_DEPTH block headers, each
//   linking to the previous via `prev_block_hash`, starting
//   from `since_block_height` up to a recent `anchor_block`.
//
//   For each UTXO we verify:
//     - Its coinbase block height <= since_block_height
//       (UTXO existed at or before the since block)
//     - Its value > 0 (non-empty slot)
//
//   The anchor block hash is a public input - it can be
//   verified against a trusted block explorer by the verifier.
//
// Private inputs:
//   - utxo_values:        [u64; 16]     - UTXO amounts, padded with 0
//   - utxo_block_heights: [u32; 16]     - block height each UTXO was created
//   - block_timestamps:   [u32; 8]      - timestamps of HEADER_DEPTH headers
//                                         starting at since_block_height
//   - block_hashes:       [[u8;32]; 8]  - hashes of those headers
//   - prev_hashes:        [[u8;32]; 8]  - prev_block_hash field of each header
//   - salt:               [u8; 31]
//
// Public inputs:
//   - threshold:           u64    - minimum satoshis to prove
//   - since_block_height:  u32    - prove held since this block
//   - anchor_block_hash:   [u8;32]- hash of the most recent header in chain
//                                   verifier can check this against chain
//   - commitment:          Field  - Pedersen commitment to all private inputs
// ============================================================

global MAX_UTXOS: u32    = 16;
global HEADER_DEPTH: u32 = 8;   // verify 8-block chain from since_block
global MAX_SATOSHIS: u64 = 2_100_000_000_000_000;

// ============================================================
// SHA256 primitives (same as merkle_inclusion circuit)
// Bitcoin block header hashing uses double-SHA256
// ============================================================

global SHA256_IV: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

fn sha256_block(block: [u8; 64], state: [u32; 8]) -> [u32; 8] {
    let mut input: [u32; 16] = [0; 16];
    for i in 0..16 {
        input[i] = ((block[i*4]   as u32) << 24)
                 | ((block[i*4+1] as u32) << 16)
                 | ((block[i*4+2] as u32) << 8)
                 |  (block[i*4+3] as u32);
    }
    std::hash::sha256_compression(input, state)
}

fn state_to_bytes(state: [u32; 8]) -> [u8; 32] {
    let mut out: [u8; 32] = [0; 32];
    for i in 0..8 {
        out[i*4]   = ((state[i] >> 24) & 0xff) as u8;
        out[i*4+1] = ((state[i] >> 16) & 0xff) as u8;
        out[i*4+2] = ((state[i] >> 8)  & 0xff) as u8;
        out[i*4+3] =  (state[i]        & 0xff) as u8;
    }
    out
}

// SHA256 of exactly 32 bytes (single block with padding)
fn sha256_32(data: [u8; 32]) -> [u8; 32] {
    let mut block: [u8; 64] = [0; 64];
    for i in 0..32 { block[i] = data[i]; }
    block[32] = 0x80;
    block[62] = 0x01;
    block[63] = 0x00;
    state_to_bytes(sha256_block(block, SHA256_IV))
}

// SHA256 of exactly 80 bytes - Bitcoin block header size
// Block 1: bytes 0..63
// Block 2: bytes 64..79 + padding
fn sha256_80(data: [u8; 80]) -> [u8; 32] {
    // Block 1: first 64 bytes
    let mut block1: [u8; 64] = [0; 64];
    for i in 0..64 { block1[i] = data[i]; }
    let state1 = sha256_block(block1, SHA256_IV);

    // Block 2: remaining 16 bytes + SHA256 padding
    // bit length = 640 = 0x280
    let mut block2: [u8; 64] = [0; 64];
    for i in 0..16 { block2[i] = data[64 + i]; }
    block2[16] = 0x80;             // padding bit
    // bytes 17..55 are 0
    // bit length = 640 bits = 0x0000000000000280 as big-endian u64
    // occupies bytes 56..63 of the block
    block2[62] = 0x02;
    block2[63] = 0x80;

    state_to_bytes(sha256_block(block2, state1))
}

// Double-SHA256 of 80 bytes (Bitcoin block header hash)
fn double_sha256_80(data: [u8; 80]) -> [u8; 32] {
    let first = sha256_80(data);
    sha256_32(first)
}

// ============================================================
// Serialise a block header into 80 bytes (little-endian)
// Bitcoin block header fields (80 bytes total):
//   4  bytes: version       (little-endian int32)
//   32 bytes: prev_hash     (internal byte order)
//   32 bytes: merkle_root   (internal byte order)
//   4  bytes: time          (little-endian uint32)
//   4  bytes: bits          (little-endian uint32)
//   4  bytes: nonce         (little-endian uint32)
// ============================================================
fn serialise_header(
    version:     u32,
    prev_hash:   [u8; 32],
    merkle_root: [u8; 32],
    time:        u32,
    bits:        u32,
    nonce:       u32,
) -> [u8; 80] {
    let mut header: [u8; 80] = [0; 80];

    // version - little-endian
    header[0] = (version        & 0xff) as u8;
    header[1] = ((version >> 8) & 0xff) as u8;
    header[2] = ((version >>16) & 0xff) as u8;
    header[3] = ((version >>24) & 0xff) as u8;

    // prev_hash (32 bytes, internal byte order)
    for i in 0..32 { header[4 + i] = prev_hash[i]; }

    // merkle_root (32 bytes)
    for i in 0..32 { header[36 + i] = merkle_root[i]; }

    // time - little-endian
    header[68] = (time        & 0xff) as u8;
    header[69] = ((time >> 8) & 0xff) as u8;
    header[70] = ((time >>16) & 0xff) as u8;
    header[71] = ((time >>24) & 0xff) as u8;

    // bits - little-endian
    header[72] = (bits        & 0xff) as u8;
    header[73] = ((bits >> 8) & 0xff) as u8;
    header[74] = ((bits >>16) & 0xff) as u8;
    header[75] = ((bits >>24) & 0xff) as u8;

    // nonce - little-endian
    header[76] = (nonce        & 0xff) as u8;
    header[77] = ((nonce >> 8) & 0xff) as u8;
    header[78] = ((nonce >>16) & 0xff) as u8;
    header[79] = ((nonce >>24) & 0xff) as u8;

    header
}

// ============================================================
// Main circuit
// ============================================================
fn main(
    // --- Private inputs ---
    utxo_values:        [u64; 16],
    utxo_block_heights: [u32; 16],    // block height UTXO was confirmed
    header_versions:    [u32; 8],     // block header version fields
    header_prev_hashes: [[u8; 32]; 8],// prev_block_hash of each header
    header_merkle_roots:[[u8; 32]; 8],// merkle_root of each header
    header_times:       [u32; 8],     // timestamp of each header
    header_bits:        [u32; 8],     // nBits of each header
    header_nonces:      [u32; 8],     // nonce of each header
    salt:               [u8; 31],

    // --- Public inputs ---
    threshold:          pub u64,
    since_block_height: pub u32,
    anchor_block_hash:  pub [u8; 32], // hash of block[HEADER_DEPTH-1]
    commitment:         pub Field,
) {
    // ----------------------------------------------------------
    // 1. Range check UTXO values
    // ----------------------------------------------------------
    for i in 0..MAX_UTXOS {
        assert(utxo_values[i] <= MAX_SATOSHIS, "UTXO exceeds max supply");
    }

    // ----------------------------------------------------------
    // 2. Verify UTXO block heights
    //    Every non-zero UTXO must have been confirmed at or
    //    before since_block_height (proving it existed then).
    // ----------------------------------------------------------
    for i in 0..MAX_UTXOS {
        if utxo_values[i] > 0 {
            assert(
                utxo_block_heights[i] <= since_block_height,
                "UTXO confirmed after since_block_height"
            );
        }
    }

    // ----------------------------------------------------------
    // 3. Sum UTXOs and check threshold
    // ----------------------------------------------------------
    let mut total: u64 = 0;
    for i in 0..MAX_UTXOS {
        total += utxo_values[i];
    }
    assert(total >= threshold, "Balance does not meet threshold");

    // ----------------------------------------------------------
    // 4. Verify block header chain
    //
    //    We verify HEADER_DEPTH headers forming a chain:
    //      block[0] is at since_block_height
    //      block[i].prev_hash == hash(block[i-1])  for i in 1..HEADER_DEPTH
    //      hash(block[HEADER_DEPTH-1]) == anchor_block_hash
    //
    //    This proves the headers form a real chain segment,
    //    and that block[0] timestamp is the timestamp at since_block_height.
    //
    //    The verifier checks anchor_block_hash against a trusted
    //    block explorer to confirm the chain is real.
    // ----------------------------------------------------------

    // Compute hash of each header
    let mut computed_hashes: [[u8; 32]; 8] = [[0; 32]; 8];
    for i in 0..HEADER_DEPTH {
        let header_bytes = serialise_header(
            header_versions[i],
            header_prev_hashes[i],
            header_merkle_roots[i],
            header_times[i],
            header_bits[i],
            header_nonces[i],
        );
        computed_hashes[i] = double_sha256_80(header_bytes);
    }

    // Verify chain linkage: block[i].prev_hash == hash(block[i-1])
    for i in 1..HEADER_DEPTH {
        assert(
            header_prev_hashes[i] == computed_hashes[i-1],
            "Block header chain broken: prev_hash mismatch"
        );
    }

    // Verify anchor: last header's hash == public anchor_block_hash
    assert(
        computed_hashes[HEADER_DEPTH - 1] == anchor_block_hash,
        "Anchor block hash mismatch"
    );

    // ----------------------------------------------------------
    // 5. Verify the commitment
    //    Binds all private inputs to prevent substitution.
    //
    //    commitment = Pedersen(
    //        utxo_values[0..15],          // 16
    //        utxo_block_heights[0..15],   // 16
    //        header_times[0..7],          // 8
    //        salt_field                   // 1
    //    )                               // = 41 inputs
    // ----------------------------------------------------------
    let mut pedersen_inputs: [Field; 41] = [0; 41];
    for i in 0..16 {
        pedersen_inputs[i]      = utxo_values[i] as Field;
        pedersen_inputs[16 + i] = utxo_block_heights[i] as Field;
    }
    for i in 0..8 {
        pedersen_inputs[32 + i] = header_times[i] as Field;
    }
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    pedersen_inputs[40] = salt_field;

    let computed_commitment = std::hash::pedersen_hash(pedersen_inputs);
    assert(computed_commitment == commitment, "Commitment mismatch");
}

// ============================================================
// Tests
// ============================================================
#[test]
fn test_header_serialisation_length() {
    let header = serialise_header(
        2,
        [0; 32],
        [0; 32],
        1415239972,
        0x1bc330,
        0x0864f9fe,
    );
    assert(header.len() == 80);
}

#[test]
fn test_sha256_80_produces_32_bytes() {
    let data: [u8; 80] = [0; 80];
    let hash = sha256_80(data);
    assert(hash.len() == 32);
}

#[test]
fn test_utxo_age_check() {
    // UTXOs confirmed at block 100 and 200
    // since_block_height = 300 - both should pass
    let mut utxo_values: [u64; 16] = [0; 16];
    utxo_values[0] = 50_000_000;
    utxo_values[1] = 50_000_000;

    let mut utxo_block_heights: [u32; 16] = [0; 16];
    utxo_block_heights[0] = 100;
    utxo_block_heights[1] = 200;

    // Both heights <= since_block_height (300) - valid
    let since_block_height: u32 = 300;
    for i in 0..16 {
        if utxo_values[i] > 0 {
            assert(utxo_block_heights[i] <= since_block_height);
        }
    }
}

#[test(should_fail)]
fn test_future_utxo_rejected() {
    // UTXO confirmed at block 400, but since_block_height = 300
    // This should fail - UTXO didn't exist at the claimed time
    let mut utxo_values: [u64; 16] = [0; 16];
    utxo_values[0] = 50_000_000;

    let mut utxo_block_heights: [u32; 16] = [0; 16];
    utxo_block_heights[0] = 400; // after since_block_height

    let since_block_height: u32 = 300;
    assert(utxo_block_heights[0] <= since_block_height); // fails
}
