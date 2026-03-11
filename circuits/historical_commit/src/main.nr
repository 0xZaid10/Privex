use std::hash::pedersen_hash;

// Helper circuit: computes the Pedersen commitment used by the historical
// main circuit.  Inputs and packing logic MUST be identical to the
// commitment section in historical/src/main.nr.
//
// salt is passed as [u8; 31] (same type as in the main circuit).
// Only 31 bytes are packed to stay below the BN254 modulus, matching
// exactly what historical/main.nr computes.
// The browser should pass the same 31-byte salt array to both circuits.
fn main(
    utxo_values:  [u64; 16],   // same type as historical/main.nr
    utxo_heights: [u32; 16],   // same type as historical/main.nr
    header_times: [u32; 8],    // same type as historical/main.nr
    salt:         [u8; 31],    // same type as historical/main.nr
) -> pub Field {
    let mut inputs: [Field; 41] = [0; 41];
    for i in 0..16 {
        inputs[i]      = utxo_values[i] as Field;
        inputs[16 + i] = utxo_heights[i] as Field;
    }
    for i in 0..8 {
        inputs[32 + i] = header_times[i] as Field;
    }
    // Pack 31 bytes big-endian - identical to historical/main.nr
    let mut salt_field: Field = 0;
    for i in 0..31 {
        salt_field = salt_field * 256 + (salt[i] as Field);
    }
    inputs[40] = salt_field;
    pedersen_hash(inputs)
}
