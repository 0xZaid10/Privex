use std::hash::pedersen_hash;

// Helper circuit: computes the Pedersen commitment used by the balance
// main circuit.  Inputs and packing logic MUST be identical to the
// commitment section in balance/src/main.nr.
//
// salt is passed as [u8; 32] (same type as in the main circuit).
// Only the first 31 bytes are packed into a Field to stay below the
// BN254 modulus, matching exactly what balance/main.nr computes.
// The browser should pass the same 32-byte salt array to both circuits.
fn main(
    utxo_values: [u64; 16],   // same type as balance/main.nr
    salt:        [u8; 32],    // same type as balance/main.nr
) -> pub Field {
    let mut inputs: [Field; 17] = [0; 17];
    for i in 0..16 {
        inputs[i] = utxo_values[i] as Field;
    }
    // Pack first 31 bytes big-endian - identical to balance/main.nr
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    inputs[16] = salt_field;
    pedersen_hash(inputs)
}
