// ============================================================
// Balance Threshold Circuit
// Starknet Bitcoin Proof Layer
//
// Statement:  sum(utxo_values) >= threshold
//
// Private inputs (hidden from verifier):
//   - utxo_values:  array of UTXO amounts in satoshis
//   - salt:         random 32-byte blinding factor
//
// Public inputs (visible to verifier):
//   - threshold:    minimum balance in satoshis
//   - commitment:   Pedersen hash of (utxo_values || salt)
//                   binds the prover to a specific UTXO set
//
// Guarantees:
//   - Individual UTXO values are never revealed
//   - Total balance is never revealed
//   - Number of UTXOs is fixed at MAX_UTXOS = 16 (unused slots = 0)
//   - Salt prevents proof replay / correlation across proofs
// ============================================================

// Maximum number of UTXOs this circuit supports.
// Unused slots must be filled with 0 by the prover.
global MAX_UTXOS: u32 = 16;

// Satoshi cap per UTXO: 21_000_000 BTC * 100_000_000 sats = 2_100_000_000_000_000
// Fits safely in a u64 (max ~1.8 * 10^19)
global MAX_SATOSHIS: u64 = 2_100_000_000_000_000;

fn main(
    // --- Private inputs ---
    utxo_values: [u64; 16],   // satoshi amounts; pad unused slots with 0
    salt:        [u8; 32],    // random blinding factor

    // --- Public inputs ---
    threshold:   pub u64,     // minimum required balance in satoshis
    commitment:  pub Field,   // Pedersen commitment to (utxo_values || salt)
) {
    // ----------------------------------------------------------
    // 1. Range-check every UTXO value.
    //    Each value must be <= MAX_SATOSHIS.
    //    This prevents integer overflow in the summation.
    // ----------------------------------------------------------
    for i in 0..MAX_UTXOS {
        assert(utxo_values[i] <= MAX_SATOSHIS,
            "UTXO value exceeds maximum possible Bitcoin supply");
    }

    // ----------------------------------------------------------
    // 2. Sum all UTXO values.
    //    Unused slots are 0, so they contribute nothing.
    //    We accumulate in u64; overflow is prevented by the
    //    range checks above (16 * MAX_SATOSHIS << u64::MAX).
    // ----------------------------------------------------------
    let mut total: u64 = 0;
    for i in 0..MAX_UTXOS {
        total += utxo_values[i];
    }

    // ----------------------------------------------------------
    // 3. Assert the balance condition.
    //    This is the core statement being proven.
    // ----------------------------------------------------------
    assert(total >= threshold, "Balance does not meet threshold");

    // ----------------------------------------------------------
    // 4. Verify the commitment.
    //    commitment = Pedersen(utxo_values[0], ..., utxo_values[15],
    //                          salt_field)
    //    This binds the prover to the exact UTXO set used and
    //    prevents reuse of the same proof with different inputs.
    //
    //    We convert each u64 to a Field for Pedersen input.
    // ----------------------------------------------------------
    let mut pedersen_inputs: [Field; 17] = [0; 17];
    for i in 0..MAX_UTXOS {
        pedersen_inputs[i] = utxo_values[i] as Field;
    }
    // Pack salt into 31 bytes (248 bits) to guarantee value stays
    // below the BN254 field modulus (~254 bits).
    // Browser-side orchestrator uses the same 31-byte truncation.
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    pedersen_inputs[16] = salt_field;

    let computed_commitment = std::hash::pedersen_hash(pedersen_inputs);
    assert(computed_commitment == commitment,
        "Commitment mismatch: inputs do not match committed UTXO set");
}

// ============================================================
// Tests
// ============================================================
#[test]
fn test_balance_above_threshold() {
    // 3 UTXOs totalling 1.0 BTC (100_000_000 sats)
    let mut values: [u64; 16] = [0; 16];
    values[0] = 50_000_000;  // 0.5 BTC
    values[1] = 30_000_000;  // 0.3 BTC
    values[2] = 20_000_000;  // 0.2 BTC

    let salt: [u8; 32] = [1; 32];
    let threshold: u64 = 50_000_000; // prove >= 0.5 BTC

    // Build commitment
    let mut pedersen_inputs: [Field; 17] = [0; 17];
    for i in 0..16 {
        pedersen_inputs[i] = values[i] as Field;
    }
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    pedersen_inputs[16] = salt_field;
    let commitment = std::hash::pedersen_hash(pedersen_inputs);

    main(values, salt, threshold, commitment);
}

#[test(should_fail)]
fn test_balance_below_threshold() {
    let mut values: [u64; 16] = [0; 16];
    values[0] = 10_000_000; // 0.1 BTC

    let salt: [u8; 32] = [2; 32];
    let threshold: u64 = 50_000_000; // require 0.5 BTC - should fail

    let mut pedersen_inputs: [Field; 17] = [0; 17];
    for i in 0..16 {
        pedersen_inputs[i] = values[i] as Field;
    }
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    pedersen_inputs[16] = salt_field;
    let commitment = std::hash::pedersen_hash(pedersen_inputs);

    main(values, salt, threshold, commitment);
}

#[test(should_fail)]
fn test_bad_commitment_rejected() {
    let mut values: [u64; 16] = [0; 16];
    values[0] = 100_000_000;

    let salt: [u8; 32] = [3; 32];
    let threshold: u64 = 50_000_000;
    let fake_commitment: Field = 0xdeadbeef;

    main(values, salt, threshold, fake_commitment);
}
