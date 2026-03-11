// Starknet Bitcoin Proof Layer — Router Contract
//
// A single entry point that routes proof verification to the correct
// Garaga-generated verifier contract based on proof type.
//
// Proof types:
//   0 = Balance Threshold      (prove BTC balance >= threshold)
//   1 = Multi-Address Balance  (prove combined BTC balance >= threshold)
//   2 = Historical Ownership   (prove BTC held since block N)
//
// Each verifier is deployed separately and registered here by the owner.
// The owner can update verifier addresses (e.g. after circuit upgrades).

use starknet::ContractAddress;

// ── Verifier interface (same for all three Garaga-generated contracts) ──────

#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

// ── Router interface ─────────────────────────────────────────────────────────

#[starknet::interface]
pub trait IBtcProofRouter<TContractState> {
    /// Verify a Bitcoin proof of the given type.
    /// proof_type: 0=balance, 1=multi_address, 2=historical
    /// username: short ASCII display name encoded as felt252 (visible on explorer)
    /// Returns the public inputs on success, or an error felt252 on failure.
    fn verify_btc_proof(
        ref self: TContractState,
        proof_type: u8,
        username: felt252,
        full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;

    /// Returns the verifier contract address for a given proof type.
    fn get_verifier(self: @TContractState, proof_type: u8) -> ContractAddress;

    /// Returns the owner address.
    fn get_owner(self: @TContractState) -> ContractAddress;

    /// Update a verifier address. Only callable by owner.
    fn set_verifier(
        ref self: TContractState, proof_type: u8, verifier_address: ContractAddress,
    );

    /// Transfer ownership. Only callable by current owner.
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}

// ── Router contract ──────────────────────────────────────────────────────────

#[starknet::contract]
mod BtcProofRouter {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use super::{
        IBtcProofRouter, IUltraKeccakZKHonkVerifierDispatcher,
        IUltraKeccakZKHonkVerifierDispatcherTrait,
    };

    // ── Proof type constants ─────────────────────────────────────────────────
    const PROOF_TYPE_BALANCE: u8 = 0;
    const PROOF_TYPE_MULTI_ADDRESS: u8 = 1;
    const PROOF_TYPE_HISTORICAL: u8 = 2;

    // ── Storage ──────────────────────────────────────────────────────────────
    #[storage]
    struct Storage {
        /// Maps proof_type (0/1/2) → verifier contract address
        verifiers: Map<u8, ContractAddress>,
        /// Contract owner — can update verifier addresses
        owner: ContractAddress,
    }

    // ── Events ───────────────────────────────────────────────────────────────
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProofVerified: ProofVerified,
        VerifierUpdated: VerifierUpdated,
        OwnershipTransferred: OwnershipTransferred,
    }

    /// Emitted on every successful proof verification.
    /// username and commitment are visible in the Events tab on Starkscan.
    #[derive(Drop, starknet::Event)]
    pub struct ProofVerified {
        #[key]
        pub proof_type: u8,
        #[key]
        pub caller: ContractAddress,
        /// ASCII display name supplied by the prover — visible on Starkscan
        pub username: felt252,
        /// ZK commitment from the proof public inputs (binds username to the proof)
        pub commitment: u256,
    }

    /// Emitted when a verifier address is updated.
    #[derive(Drop, starknet::Event)]
    pub struct VerifierUpdated {
        #[key]
        pub proof_type: u8,
        pub old_address: ContractAddress,
        pub new_address: ContractAddress,
    }

    /// Emitted when ownership is transferred.
    #[derive(Drop, starknet::Event)]
    pub struct OwnershipTransferred {
        #[key]
        pub previous_owner: ContractAddress,
        #[key]
        pub new_owner: ContractAddress,
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    /// Deploy with the three verifier contract addresses and the owner address.
    /// Verifier addresses can be zero during initial deploy and set later via
    /// set_verifier(), but proofs cannot be verified until all three are set.
    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        balance_verifier: ContractAddress,
        multi_address_verifier: ContractAddress,
        historical_verifier: ContractAddress,
    ) {
        self.owner.write(owner);
        self.verifiers.entry(PROOF_TYPE_BALANCE).write(balance_verifier);
        self.verifiers.entry(PROOF_TYPE_MULTI_ADDRESS).write(multi_address_verifier);
        self.verifiers.entry(PROOF_TYPE_HISTORICAL).write(historical_verifier);
    }

    // ── Public implementation ────────────────────────────────────────────────
    #[abi(embed_v0)]
    impl BtcProofRouterImpl of IBtcProofRouter<ContractState> {

        fn verify_btc_proof(
            ref self: ContractState,
            proof_type: u8,
            username: felt252,
            full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            // Validate proof type
            assert(
                proof_type == PROOF_TYPE_BALANCE
                    || proof_type == PROOF_TYPE_MULTI_ADDRESS
                    || proof_type == PROOF_TYPE_HISTORICAL,
                'invalid proof type',
            );

            // Look up verifier address
            let verifier_address = self.verifiers.entry(proof_type).read();
            assert(!verifier_address.is_zero(), 'verifier not set');

            // Dispatch to the correct Garaga-generated verifier
            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: verifier_address,
            };
            let result = verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints);

            // Emit enriched event on success, including username + commitment
            // Public inputs layout: [threshold: u256, commitment: u256]
            // Each u256 is two felts (high, low) in the returned Span<u256>.
            // commitment is public_inputs[1].
            match result {
                Result::Ok(public_inputs) => {
                    // Extract commitment (second public input = index 1)
                    let commitment: u256 = if public_inputs.len() > 1 {
                        *public_inputs.at(1)
                    } else {
                        0_u256
                    };
                    self.emit(ProofVerified {
                        proof_type,
                        caller: get_caller_address(),
                        username,
                        commitment,
                    });
                },
                Result::Err(_) => {},
            }

            result
        }

        fn get_verifier(self: @ContractState, proof_type: u8) -> ContractAddress {
            self.verifiers.entry(proof_type).read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn set_verifier(
            ref self: ContractState, proof_type: u8, verifier_address: ContractAddress,
        ) {
            // Only owner can update verifier addresses
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');

            assert(
                proof_type == PROOF_TYPE_BALANCE
                    || proof_type == PROOF_TYPE_MULTI_ADDRESS
                    || proof_type == PROOF_TYPE_HISTORICAL,
                'invalid proof type',
            );

            let old_address = self.verifiers.entry(proof_type).read();
            self.verifiers.entry(proof_type).write(verifier_address);

            self.emit(VerifierUpdated { proof_type, old_address, new_address: verifier_address });
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'only owner');
            assert(!new_owner.is_zero(), 'zero address');

            let previous_owner = self.owner.read();
            self.owner.write(new_owner);

            self.emit(OwnershipTransferred { previous_owner, new_owner });
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), 'only owner');
        }
    }
}
