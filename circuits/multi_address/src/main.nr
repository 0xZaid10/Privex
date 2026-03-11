// ============================================================
// Multi-Address Balance Circuit
// Starknet Bitcoin Proof Layer
//
// Statement:  sum of UTXOs across MAX_ADDRESSES Bitcoin addresses
//             is >= threshold
//
// Real wallets spread funds across many addresses.
// This circuit proves a combined balance without revealing:
//   - individual address balances
//   - which addresses are involved
//   - total combined balance
//   - UTXO composition of any address
//
// Design:
//   MAX_ADDRESSES = 8   - up to 8 addresses
//   MAX_UTXOS_PER_ADDRESS = 8  - up to 8 UTXOs per address
//   Total slots = 64 UTXOs
//   Unused slots filled with 0
//
// Private inputs:
//   - utxo_values:   [u64; 8][8]  - values per address, padded with 0
//   - address_salts: [u8; 31][8]  - per-address blinding salt
//
// Public inputs:
//   - threshold:           u64     - minimum combined balance
//   - combined_commitment: Field   - Pedersen(all_values || global_salt)
//   - address_count:       u32     - how many addresses are active (1..8)
// ============================================================

global MAX_ADDRESSES: u32 = 8;
global MAX_UTXOS_PER: u32 = 8;
global MAX_SATOSHIS: u64   = 2_100_000_000_000_000;

fn main(
    // --- Private inputs ---
    // utxo_values[i][j] = value of j-th UTXO of i-th address
    // Pad unused addresses AND unused UTXOs with 0
    utxo_values:   [[u64; 8]; 8],
    // Per-address salt - 31 bytes to stay below BN254 modulus
    address_salts: [[u8; 31]; 8],

    // --- Public inputs ---
    threshold:           pub u64,
    combined_commitment: pub Field,
    address_count:       pub u32,
) {
    // ----------------------------------------------------------
    // 1. Validate address_count is in range [1, MAX_ADDRESSES]
    // ----------------------------------------------------------
    assert(address_count >= 1, "Must have at least 1 address");
    assert(address_count <= MAX_ADDRESSES as u32, "Exceeds MAX_ADDRESSES");

    // ----------------------------------------------------------
    // 2. Range-check all UTXO values
    // ----------------------------------------------------------
    for i in 0..MAX_ADDRESSES {
        for j in 0..MAX_UTXOS_PER {
            assert(
                utxo_values[i][j] <= MAX_SATOSHIS,
                "UTXO value exceeds maximum Bitcoin supply"
            );
        }
    }

    // ----------------------------------------------------------
    // 3. Sum all UTXO values across ACTIVE addresses only.
    //    Only slots 0..address_count-1 are active.
    //    Slots address_count..MAX_ADDRESSES must be zero.
    //    This enforces that address_count actually constrains
    //    which addresses contribute to the balance, preventing
    //    a prover from hiding UTXOs in "inactive" slots.
    // ----------------------------------------------------------
    let mut total: u64 = 0;
    for i in 0..MAX_ADDRESSES {
        let is_active = (i as u32) < address_count;
        for j in 0..MAX_UTXOS_PER {
            if is_active {
                total += utxo_values[i][j];
            } else {
                // Inactive slots MUST be zero - enforce this so
                // a prover cannot stuff hidden UTXOs into them.
                assert(
                    utxo_values[i][j] == 0,
                    "Inactive address slot must be zero"
                );
            }
        }
    }

    // ----------------------------------------------------------
    // 4. Assert combined balance meets threshold
    // ----------------------------------------------------------
    assert(total >= threshold, "Combined balance does not meet threshold");

    // ----------------------------------------------------------
    // 5. Verify the combined commitment.
    //
    //    We build a flat array of all 64 UTXO values plus
    //    all 8 salt fields, then Pedersen hash the whole thing.
    //
    //    Inactive address UTXO slots are already constrained to zero
    //    (enforced in step 3). We also enforce inactive salts are zero
    //    so the prover has no free variables in the inactive slots.
    //
    //    commitment = Pedersen(
    //        utxo_values[0][0], ..., utxo_values[7][7],  // 64 values
    //        salt_field[0], ..., salt_field[7]            // 8 salts
    //    )
    //
    //    Total: 72 Field inputs.
    // ----------------------------------------------------------
    let mut pedersen_inputs: [Field; 72] = [0; 72];

    // Pack UTXO values
    for i in 0..MAX_ADDRESSES {
        for j in 0..MAX_UTXOS_PER {
            pedersen_inputs[i * MAX_UTXOS_PER + j] = utxo_values[i][j] as Field;
        }
    }

    // Pack salts (31 bytes each -> Field).
    // Inactive address salts must be all-zero bytes.
    for i in 0..MAX_ADDRESSES {
        let is_active = (i as u32) < address_count;
        let mut salt_field: Field = 0;
        for k in 0..31 {
            let byte = address_salts[i][k];
            if !is_active {
                assert(byte == 0, "Inactive address salt must be zero");
            }
            salt_field = salt_field * 256 + (byte as Field);
        }
        pedersen_inputs[64 + i] = salt_field;
    }

    let computed_commitment = std::hash::pedersen_hash(pedersen_inputs);
    assert(
        computed_commitment == combined_commitment,
        "Combined commitment mismatch"
    );
}

// ============================================================
// Tests
// ============================================================
#[test]
fn test_multi_address_above_threshold() {
    // 3 addresses, 2 UTXOs each
    // Address 0: 0.5 BTC + 0.2 BTC = 0.7 BTC
    // Address 1: 0.3 BTC + 0.1 BTC = 0.4 BTC
    // Address 2: 0.1 BTC            = 0.1 BTC
    // Total: 1.2 BTC, prove >= 1.0 BTC
    // Addresses 3..7 are inactive and must remain zero.

    let mut values: [[u64; 8]; 8] = [[0; 8]; 8];
    values[0][0] = 50_000_000;
    values[0][1] = 20_000_000;
    values[1][0] = 30_000_000;
    values[1][1] = 10_000_000;
    values[2][0] = 10_000_000;
    // values[3..7] remain [[0;8];8] - inactive, enforced to zero

    let salts: [[u8; 31]; 8] = [[1; 31]; 8];
    let threshold: u64 = 100_000_000; // 1.0 BTC
    let address_count: u32 = 3;

    // Build commitment
    let mut pedersen_inputs: [Field; 72] = [0; 72];
    for i in 0..8 {
        for j in 0..8 {
            pedersen_inputs[i * 8 + j] = values[i][j] as Field;
        }
    }
    for i in 0..8 {
        let mut salt_field: Field = 0;
        for k in 0..31 {
            salt_field = salt_field * 256 + (salts[i][k] as Field);
        }
        pedersen_inputs[64 + i] = salt_field;
    }
    let commitment = std::hash::pedersen_hash(pedersen_inputs);

    main(values, salts, threshold, commitment, address_count);
}

#[test(should_fail)]
fn test_multi_address_below_threshold() {
    let mut values: [[u64; 8]; 8] = [[0; 8]; 8];
    values[0][0] = 10_000_000; // 0.1 BTC total

    let salts: [[u8; 31]; 8] = [[2; 31]; 8];
    let threshold: u64 = 100_000_000; // require 1 BTC - fails

    let mut pedersen_inputs: [Field; 72] = [0; 72];
    for i in 0..8 {
        for j in 0..8 {
            pedersen_inputs[i * 8 + j] = values[i][j] as Field;
        }
    }
    for i in 0..8 {
        let mut salt_field: Field = 0;
        for k in 0..31 {
            salt_field = salt_field * 256 + (salts[i][k] as Field);
        }
        pedersen_inputs[64 + i] = salt_field;
    }
    let commitment = std::hash::pedersen_hash(pedersen_inputs);

    main(values, salts, threshold, commitment, 1);
}

#[test(should_fail)]
fn test_zero_addresses_rejected() {
    let values: [[u64; 8]; 8] = [[0; 8]; 8];
    let salts: [[u8; 31]; 8] = [[3; 31]; 8];
    let commitment: Field = 0;
    main(values, salts, 0, commitment, 0); // address_count = 0 should fail
}

#[test(should_fail)]
fn test_hidden_utxo_in_inactive_slot_rejected() {
    // address_count = 1 but UTXOs stuffed into slot 2 (inactive).
    // Before the fix this would silently pass; now it must fail.
    let mut values: [[u64; 8]; 8] = [[0; 8]; 8];
    values[0][0] = 10_000_000; // active address
    values[2][0] = 90_000_000; // hidden in inactive slot - MUST be rejected

    // Only slot 0 has a real salt; inactive slots are zero
    let mut salts: [[u8; 31]; 8] = [[0; 31]; 8];
    salts[0] = [4; 31];

    let threshold: u64 = 100_000_000; // would only pass if hidden UTXOs counted

    let mut pedersen_inputs: [Field; 72] = [0; 72];
    for i in 0..8 {
        for j in 0..8 {
            pedersen_inputs[i * 8 + j] = values[i][j] as Field;
        }
    }
    for i in 0..8 {
        let mut salt_field: Field = 0;
        for k in 0..31 {
            salt_field = salt_field * 256 + (salts[i][k] as Field);
        }
        pedersen_inputs[64 + i] = salt_field;
    }
    let commitment = std::hash::pedersen_hash(pedersen_inputs);

    main(values, salts, threshold, commitment, 1); // fails: slot 2 is non-zero
}

