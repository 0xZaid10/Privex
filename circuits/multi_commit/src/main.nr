use std::hash::pedersen_hash;

// Helper circuit: computes the Pedersen commitment used by the
// multi_address main circuit.
// Inputs and packing logic MUST be identical to the commitment
// section in multi_address/src/main.nr.
//
// utxo_values: [[u64;8];8] - same type as multi_address/main.nr
// salts:       [[u8;31];8] - same type as multi_address/main.nr
//   each salt is packed big - endian from 31 bytes, NOT pre-packed Field
//
// The browser passes the same raw arrays to both circuits.
fn main(
    utxo_values: [[u64; 8]; 8],   // same type as multi_address/main.nr
    salts:       [[u8; 31]; 8],   // same type as multi_address/main.nr
) -> pub Field {
    let mut inputs: [Field; 72] = [0; 72];
    // Pack UTXO values - identical to multi_address/main.nr
    for i in 0..8 {
        for j in 0..8 {
            inputs[i * 8 + j] = utxo_values[i][j] as Field;
        }
    }
    // Pack salts 31 bytes big - endian - identical to multi_address/main.nr
    for i in 0..8 {
        let mut salt_field: Field = 0;
        for k in 0..31 {
            salt_field = salt_field * 256 + (salts[i][k] as Field);
        }
        inputs[64 + i] = salt_field;
    }
    pedersen_hash(inputs)
}
