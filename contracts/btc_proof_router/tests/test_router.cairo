// Tests for BtcProofRouter
// Run with: snforge test

use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use btc_proof_router::btc_proof_router::{
    IBtcProofRouterDispatcher, IBtcProofRouterDispatcherTrait,
};

// Helper: deploy router with dummy verifier addresses
fn deploy_router(
    owner: ContractAddress,
    bal: ContractAddress,
    multi: ContractAddress,
    hist: ContractAddress,
) -> IBtcProofRouterDispatcher {
    let contract = declare("BtcProofRouter").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    calldata.append(owner.into());
    calldata.append(bal.into());
    calldata.append(multi.into());
    calldata.append(hist.into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IBtcProofRouterDispatcher { contract_address }
}

#[test]
fn test_constructor_sets_verifiers() {
    let owner: ContractAddress = 0x1.try_into().unwrap();
    let bal: ContractAddress = 0x100.try_into().unwrap();
    let multi: ContractAddress = 0x200.try_into().unwrap();
    let hist: ContractAddress = 0x300.try_into().unwrap();

    let router = deploy_router(owner, bal, multi, hist);

    assert(router.get_verifier(0) == bal, 'balance verifier wrong');
    assert(router.get_verifier(1) == multi, 'multi verifier wrong');
    assert(router.get_verifier(2) == hist, 'historical verifier wrong');
    assert(router.get_owner() == owner, 'owner wrong');
}

#[test]
fn test_set_verifier_by_owner() {
    let owner: ContractAddress = 0x1.try_into().unwrap();
    let bal: ContractAddress = 0x100.try_into().unwrap();
    let new_bal: ContractAddress = 0x999.try_into().unwrap();
    let router = deploy_router(
        owner, bal, 0x200.try_into().unwrap(), 0x300.try_into().unwrap(),
    );

    start_cheat_caller_address(router.contract_address, owner);
    router.set_verifier(0, new_bal);
    stop_cheat_caller_address(router.contract_address);

    assert(router.get_verifier(0) == new_bal, 'verifier not updated');
}

#[test]
#[should_panic(expected: ('only owner',))]
fn test_set_verifier_reverts_non_owner() {
    let owner: ContractAddress = 0x1.try_into().unwrap();
    let attacker: ContractAddress = 0xdead.try_into().unwrap();
    let router = deploy_router(
        owner,
        0x100.try_into().unwrap(),
        0x200.try_into().unwrap(),
        0x300.try_into().unwrap(),
    );

    start_cheat_caller_address(router.contract_address, attacker);
    router.set_verifier(0, 0x999.try_into().unwrap());
    stop_cheat_caller_address(router.contract_address);
}

#[test]
fn test_transfer_ownership() {
    let owner: ContractAddress = 0x1.try_into().unwrap();
    let new_owner: ContractAddress = 0x2.try_into().unwrap();
    let router = deploy_router(
        owner,
        0x100.try_into().unwrap(),
        0x200.try_into().unwrap(),
        0x300.try_into().unwrap(),
    );

    start_cheat_caller_address(router.contract_address, owner);
    router.transfer_ownership(new_owner);
    stop_cheat_caller_address(router.contract_address);

    assert(router.get_owner() == new_owner, 'ownership not transferred');
}

#[test]
#[should_panic(expected: ('invalid proof type',))]
fn test_verify_invalid_proof_type_reverts() {
    let owner: ContractAddress = 0x1.try_into().unwrap();
    let router = deploy_router(
        owner,
        0x100.try_into().unwrap(),
        0x200.try_into().unwrap(),
        0x300.try_into().unwrap(),
    );
    // proof_type 99 is invalid
    router.verify_btc_proof(99, array![].span());
}
