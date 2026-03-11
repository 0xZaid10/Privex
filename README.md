# Privex — Private Bitcoin Proof Layer on Starknet

> **Prove what you own. Reveal nothing else.**  
> Zero-knowledge proofs for Bitcoin holdings, verified on-chain on Starknet — entirely in your browser.

---

## Table of Contents

- [What is Privex](#what-is-privex)
- [The Problem](#the-problem)
- [How It Works](#how-it-works)
- [Three Types of Proofs](#three-types-of-proofs)
- [The Report System](#the-report-system)
- [Who Can Use Privex](#who-can-use-privex)
- [Privacy Architecture](#privacy-architecture)
- [Technical Foundation](#technical-foundation)
- [Repo Structure](#repo-structure)
- [Circuits — Deep Dive](#circuits--deep-dive)
- [Contracts — Deep Dive](#contracts--deep-dive)
- [App — Deep Dive](#app--deep-dive)
- [Deployed Contracts](#deployed-contracts--starknet-sepolia)
- [Current Status](#current-status)
- [Running Locally](#running-locally)
- [Toolchain Versions](#toolchain-versions)
- [Roadmap](#roadmap)
- [Why Starknet](#why-starknet)

---

## What is Privex

Privex is a zero-knowledge proof system that lets Bitcoin holders prove facts about their holdings on Starknet without revealing their address, balance, or transaction history.

Everything runs in the browser. Your Bitcoin data never leaves your machine. Only the final cryptographic proof goes on-chain.

**By the numbers:**
- 6 Noir ZK circuits
- 5 contracts deployed on Starknet Sepolia
- ~2978 felt252 calldata elements per proof
- ~15 second in-browser proving time
- 0 bytes of Bitcoin address data sent to any server

---

## The Problem

Bitcoin is the most widely held, most trusted store of value in crypto. But Bitcoin holders are completely locked out of the on-chain economy unless they sacrifice their privacy entirely.

**Today, if you want to:**
- Access a platform or community that requires proof of assets
- Participate in DAO governance weighted by BTC holdings
- Prove your long-term holder status to unlock platform tiers
- Verify your net worth to a fund, partner, or counterparty
- Gate access to a community or airdrop by Bitcoin holdings

**You are forced to:**
- Expose your Bitcoin wallet address publicly
- Reveal your exact balance — down to the satoshi
- Expose every transaction you have ever made
- Link your Bitcoin identity to your on-chain identity permanently
- Hand over your full financial history to anyone who asks

Bitcoin addresses are pseudonymous, not anonymous. Once an address is linked to your identity, everything — every wallet you have touched, every exchange you have used, every counterparty — becomes visible. Bitcoin's longest-term holders are also its most privacy-conscious, and they have been forced to choose between participating in the new financial system and protecting themselves.

**Privex eliminates that choice entirely.**

---

## How It Works

### For users

1. **Open Privex in your browser** — no installation, no wallet needed to generate a proof
2. **Enter your Bitcoin address and threshold** — e.g. "prove I hold at least 0.5 BTC"
3. **Wait ~15 seconds** — your browser fetches UTXO data from mempool.space and generates a ZK proof entirely locally. Your address never leaves your machine
4. **Connect your Starknet wallet** — Argent X or Braavos
5. **Submit the proof on-chain** — one transaction to the Privex router contract on Starknet Sepolia
6. **Share your proof** — verifiable by anyone on Voyager. Download a public certificate or full private report

### What the proof says
✅ This person holds **at least X BTC**  
✅ This person has held **at least X BTC since block N**  
✅ This person holds **at least X BTC across multiple addresses combined**  

### What the proof never reveals
❌ Which Bitcoin address was used  
❌ The exact balance  
❌ Any transaction history  
❌ Any counterparty information  
❌ Any link between the Bitcoin address and the Starknet address  

---

## Three Types of Proofs

### 🔵 Balance Threshold
> *"I hold at least X BTC right now"*
- Prove current balance exceeds any threshold you choose
- Single Bitcoin address
- Useful for platform access, airdrop eligibility, community gating

### 🟣 Multi-Address Balance
> *"My combined holdings across multiple addresses exceed X BTC"*
- Aggregate up to 8 Bitcoin addresses into a single proof
- Addresses are never linked to each other in the proof
- Useful for holders who spread funds across cold wallets

### 🟠 Historical Ownership
> *"I have held at least X BTC since Bitcoin block N"*
- Proves long-term holder status anchored to a specific block
- Auto-detects the oldest confirmed UTXO block for the address
- Validates against 8 consecutive Bitcoin block headers
- Useful for OG holder verification, loyalty tiers, governance weight

---

## The Report System

After running both the balance and historical proofs, Privex generates two downloadable certificates.

### 📄 Public Report
Safe to share with anyone. Contains:
- Proof type and threshold proved
- Since-block for historical ownership
- Starknet transaction hashes (verifiable by anyone on Voyager)
- Username chosen by the user (visible on-chain)
- Timestamp of proof generation
- No information that can identify the Bitcoin address

### 🔒 Private Report
For your own records. Contains everything in the public report plus:
- Full technical proof details and public inputs
- Commitment hashes
- Timing information (proof generation duration)
- On-chain block numbers, timestamps, and transaction fees

---

## Who Can Use Privex

**🟠 Long-term Bitcoin holders**  
Prove OG status and holding duration without exposing wallet history or transaction timeline.

**🔵 On-chain participants**  
Access Starknet applications and communities with Bitcoin-backed credentials — no bridging, no wrapping.

**🟣 DAO participants**  
Vote or govern with BTC-weighted influence without linking your Bitcoin identity to your governance wallet.

**💼 Funds & investors**  
Prove track record or portfolio size to partners and counterparties without full financial disclosure.

**🛠 Platform builders**  
Gate access, loyalty tiers, or airdrops by verified Bitcoin holdings using on-chain proof verification.

**🔒 Privacy-conscious hodlers**  
Participate in the on-chain economy without sacrificing the pseudonymity Bitcoin was designed to provide.

**🗂 Multi-wallet holders**  
Aggregate proof across multiple cold wallets without publicly linking them to each other or to your identity.

---

## Privacy Architecture

Privacy in Privex is enforced by architecture, not policy.

- **Bitcoin address stays local** — UTXO data is fetched directly from mempool.space inside your browser. The address is never sent to any Privex server
- **Proof generation is fully client-side** — the ZK circuit runs in your browser via WebAssembly (bb.js). No server sees your inputs at any point
- **On-chain data is minimal** — Starknet receives only the encoded proof calldata and a commitment hash. The commitment is a one-way cryptographic binding and cannot be reversed to reveal the address
- **Reports are address-free by design** — the report data structure intentionally has no field for the Bitcoin address. It cannot be accidentally included
- **Username is optional and self-chosen** — appears on Voyager but is completely disconnected from your Bitcoin identity

> ⚠️ **Current Limitation — Wallet Ownership:**  
> Currently any Bitcoin address can be entered to generate a proof. There is no cryptographic check that the user actually owns the address. **Bitcoin wallet signing** (requiring a signed message from the private key) is planned and will be required before mainnet. Until then, proofs demonstrate *"this address holds X BTC"* but not *"I own this address"*.

---

## Technical Foundation

### Noir Circuits
The proof logic is written in [Noir](https://noir-lang.org/), a Rust-like domain-specific language for zero-knowledge circuits. Each circuit defines the constraints that must hold for a proof to be valid — what inputs are private, what is public, and what relationship between them is being proved.

Six circuits are compiled to the `UltraKeccakZKHonk` proving scheme:

| Circuit | Proves |
|---|---|
| `balance` | Single-address balance ≥ threshold |
| `balance_commit` | Balance with commitment hash binding |
| `multi_address` | Combined balance across ≤ 8 addresses ≥ threshold |
| `multi_commit` | Multi-address with commitment |
| `historical` | Balance ≥ threshold held since block N |
| `historical_commit` | Historical with commitment |

### UltraKeccakZKHonk
The proving scheme used by all six circuits. A modern ZK proof system with compact proof sizes (~54KB), fast verification, and Keccak-based hashing for compatibility with EVM and Starknet. The `ZK` variant adds zero-knowledge hiding to the standard Honk scheme.

### bb.js (Barretenberg)
Aztec's ZK proving backend, compiled to WebAssembly. Runs entirely in the browser — no server, no trusted setup, no external proving service. The same engine powers Aztec's own ZK circuits.

### Garaga
A Starknet-ecosystem library that does two things for Privex:
1. **Encodes** the raw Honk proof into Starknet-compatible `felt252` calldata (~2978 felts per proof)
2. **Generates** the Cairo verifier contracts directly from the compiled circuit's verification key

This is what makes on-chain Noir proof verification on Starknet practical.

### Cairo Contracts
Two custom router contracts written for Privex (see [Contracts — Deep Dive](#contracts--deep-dive)). Each router accepts a proof type, routes to the correct Garaga verifier, and emits a `ProofVerified` event on success.

### Starknet
As a ZK rollup itself, Starknet can verify ZK proofs cheaply and fast — the same operation on Ethereum L1 would cost hundreds of dollars in gas. Starknet Sepolia is the current deployment target; mainnet is on the roadmap.

---

## Repo Structure

```
privex/
├── circuits/                    Noir circuit workspace
│   ├── Nargo.toml               Workspace root
│   ├── balance/
│   ├── balance_commit/
│   ├── historical/
│   ├── historical_commit/
│   ├── multi_address/
│   └── multi_commit/
│
├── contracts/
│   ├── btc_proof_router/        v1 router — anonymous proof submission
│   │   ├── Scarb.toml
│   │   ├── src/
│   │   │   ├── lib.cairo
│   │   │   └── btc_proof_router.cairo
│   │   └── tests/
│   │       └── test_router.cairo
│   ├── btc_router/              v2 router — username-enabled
│   │   ├── Scarb.toml
│   │   ├── src/
│   │   │   ├── lib.cairo
│   │   │   └── btc_router.cairo
│   │   └── tests/
│   │       └── test_router.cairo
│   ├── balance_verifier/        Garaga-generated verifier
│   ├── multi_address_verifier/  Garaga-generated verifier
│   └── historical_verifier/     Garaga-generated verifier
│
└── app/                         Browser proof engine + frontend
    ├── vercel.json
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html               Home page
    ├── proof.html               Proof Engine page
    ├── report.html              Report Generator page
    ├── public/
    │   └── circuits/            Compiled circuit JSONs (loaded at runtime)
    │       ├── balance/
    │       ├── balance_commit/
    │       ├── historical/
    │       ├── historical_commit/
    │       ├── multi_address/
    │       └── multi_commit/
    └── src/
        ├── main.ts              Proof Engine logic
        ├── report.ts            Report Generator logic
        ├── prover.ts            ZK proof generation + Starknet submission
        ├── orchestrator.ts      Proof orchestration
        ├── new_flows.ts         Circuit-specific proof flows
        ├── bitcoin.ts           mempool.space API client
        └── index.ts             Exports
```

---

## Circuits — Deep Dive

Located in `circuits/`. All circuits share the same Noir workspace (`Nargo.toml`) and are compiled independently.

### Circuit Inputs

Each circuit takes a mix of private and public inputs:

**Balance circuit:**
- Private: Bitcoin UTXO set, amounts
- Public: threshold (u256), commitment hash

**Multi-address circuit:**
- Private: up to 8 UTXO sets and amounts
- Public: combined threshold (u256), commitment hash

**Historical circuit:**
- Private: UTXO set, Bitcoin block headers (8 consecutive)
- Public: threshold (u256), since_block_height, anchor block hash bytes (32 felts), commitment hash

### Compiling Circuits

Requires [Noir 1.0.0-beta.16](https://github.com/noir-lang/noir/releases).

```bash
cd circuits
nargo compile
```

Each circuit outputs a JSON artifact to `<circuit>/target/<circuit>.json`. These are already compiled and committed to `app/public/circuits/` for the browser engine to load at runtime — you only need to recompile if you modify the circuit logic.

### Generating Garaga Verifiers

After compiling, Garaga can generate new Cairo verifier contracts from the circuit's verification key:

```bash
# Activate Garaga virtualenv (requires garaga 1.0.1)
source ~/garaga-env/bin/activate

# Generate verifier for a circuit
garaga gen --system ultra_keccak_zk_honk --vk circuits/balance/target/vk.bin
```

---

## Contracts — Deep Dive

Located in `contracts/`. All contracts are written in Cairo 2.14.0.

### btc_proof_router — v1 (Anonymous)

The original router. Entry point for the Proof Engine page (`main.ts`).

**Interface:**
```cairo
fn verify_btc_proof(
    ref self: TContractState,
    proof_type: u8,
    full_proof_with_hints: Span<felt252>,
) -> Result<Span<u256>, felt252>
```

**Proof types:**
- `0` = Balance Threshold
- `1` = Multi-Address Balance
- `2` = Historical Ownership

**Event emitted on success:**
```cairo
ProofVerified { proof_type: u8, caller: ContractAddress, commitment: u256 }
```

**Calldata shape (from browser):**
```
[proof_type, span_len, ...proof_felts]
```

**Deployed:** `0x038e89af918aecaaf75f304a33336f8aa3c3532366d01a6bdfd064103638496d`

---

### btc_router — v2 (Username-enabled)

Extended router with username support. Entry point for the Report Generator page (`report.ts`).

**Interface:**
```cairo
fn verify_btc_proof(
    ref self: TContractState,
    proof_type: u8,
    username: felt252,
    full_proof_with_hints: Span<felt252>,
) -> Result<Span<u256>, felt252>
```

Username is a short ASCII display name (max 31 chars) encoded as a `felt252` big-endian. It is stored in the emitted event and visible on Voyager — completely disconnected from the Bitcoin address.

**Event emitted on success:**
```cairo
ProofVerified { proof_type: u8, caller: ContractAddress, username: felt252, commitment: u256 }
```

**Calldata shape (from browser):**
```
[proof_type, username_felt, span_len, ...proof_felts]
```

**Deployed:** `0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2`

---

### Garaga Verifier Contracts

Auto-generated by Garaga from each circuit's verification key. These contracts perform the actual on-chain UltraKeccakZKHonk proof verification. They are called by the routers internally and are never called directly by users.

| Contract | Address |
|---|---|
| `balance_verifier` | `0x0488037e3063230e59180cc4d02f37a2e363cf9fd77068b82aec35fc4d5ba034` |
| `multi_address_verifier` | `0x0300401397be70fe101764681e6ebfb6dea7da13c29d68c3fb065660f330e2db` |
| `historical_verifier` | `0x019e6d977cf438c87105ba49dff541d7442a9a22469687f3d4176bdd0fbb378c` |

### Building & Testing Contracts

Requires [Scarb](https://docs.swmansion.com/scarb/) (Cairo 2.14.0) and [snforge 0.53.0](https://github.com/foundry-rs/starknet-foundry).

```bash
cd contracts/btc_proof_router   # or btc_router
scarb build
snforge test
```

---

## App — Deep Dive

Located in `app/`. A Vite + TypeScript multi-page app. Three HTML entry points, each with its own TypeScript module.

### Pages

| Page | Entry | Router used |
|---|---|---|
| `index.html` | — | — (landing page) |
| `proof.html` | `src/main.ts` | `btc_proof_router` v1 |
| `report.html` | `src/report.ts` | `btc_router` v2 |

### Key modules

**`src/prover.ts`**  
Core proving engine. Handles:
- WASM initialisation (bb.js + Garaga)
- Proof generation via Noir + Barretenberg
- Garaga calldata encoding
- Starknet transaction construction and submission
- Username encoding as felt252

Contract addresses are defined here in `STARKNET_CONTRACTS`:
```typescript
router:             "0x038e89af918aecaaf75f304a33336f8aa3c3532366d01a6bdfd064103638496d"
routerV2:           "0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2"
balanceVerifier:    "0x0488037e3063230e59180cc4d02f37a2e363cf9fd77068b82aec35fc4d5ba034"
multiVerifier:      "0x0300401397be70fe101764681e6ebfb6dea7da13c29d68c3fb065660f330e2db"
historicalVerifier: "0x019e6d977cf438c87105ba49dff541d7442a9a22469687f3d4176bdd0fbb378c"
```

**`src/new_flows.ts`**  
Circuit-specific proof flows. Each flow fetches the relevant Bitcoin data, formats the circuit inputs, and calls the prover.

**`src/bitcoin.ts`**  
mempool.space API client. Fetches UTXO sets, balances, block headers, and transaction receipts. All requests go directly from the browser to `https://mempool.space/api/` — no proxy.

**`src/orchestrator.ts`**  
Orchestrates multi-step proof flows, manages state between proof generation and Starknet submission.

### COOP/COEP Headers

`vercel.json` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all routes. These are required for `SharedArrayBuffer`, which bb.js uses internally for its WASM workers. Without these headers, proof generation will fail silently in production.

### Starknet RPC

All Starknet calls go to:
```
https://starknet-sepolia.public.blastapi.io/rpc/v0_8
```

---

## Deployed Contracts — Starknet Sepolia

All five contracts are live and verifiable on [Voyager](https://sepolia.voyager.online).

| Contract | Address |
|---|---|
| `balance_verifier` | [`0x0488037e…c4d5ba034`](https://sepolia.voyager.online/contract/0x0488037e3063230e59180cc4d02f37a2e363cf9fd77068b82aec35fc4d5ba034) |
| `multi_address_verifier` | [`0x03004013…60f330e2db`](https://sepolia.voyager.online/contract/0x0300401397be70fe101764681e6ebfb6dea7da13c29d68c3fb065660f330e2db) |
| `historical_verifier` | [`0x019e6d97…0fbb378c`](https://sepolia.voyager.online/contract/0x019e6d977cf438c87105ba49dff541d7442a9a22469687f3d4176bdd0fbb378c) |
| `btc_proof_router` v1 | [`0x038e89af…03638496d`](https://sepolia.voyager.online/contract/0x038e89af918aecaaf75f304a33336f8aa3c3532366d01a6bdfd064103638496d) |
| `btc_router` v2 | [`0x002b8434…0cb3ff2`](https://sepolia.voyager.online/contract/0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2) |

---

## Current Status

| Feature | Status |
|---|---|
| Balance threshold proof | ✅ Live on Starknet Sepolia |
| Multi-address proof | ✅ Live on Starknet Sepolia |
| Historical ownership proof | ✅ Live on Starknet Sepolia |
| In-browser proof generation | ✅ ~15 seconds, no installation |
| Public + private report download | ✅ Live |
| Username on-chain (v2 router) | ✅ Live |
| Anonymous proof submission (v1 router) | ✅ Live |
| **Bitcoin wallet signing** | ⚠️ Not yet implemented |
| Starknet Mainnet | 🔜 Roadmap |

> ⚠️ **Wallet Ownership Note:**  
> Currently, any Bitcoin address can be entered to generate a proof. There is no cryptographic check that the submitter owns the address. Bitcoin wallet signing — requiring the user to sign a message with their private key — is planned and will be required before any mainnet deployment.

---

## Running Locally

### Prerequisites

| Tool | Version | Required for |
|---|---|---|
| Node.js | ≥ 18 | App |
| npm | ≥ 9 | App |
| Noir / nargo | 1.0.0-beta.16 | Recompiling circuits |
| Scarb | Cairo 2.14.0 compatible | Contracts |
| snforge | 0.53.0 | Contract tests |
| Python + Garaga | 1.0.1 | Regenerating verifiers |

---

### 1. Run the App (Frontend)

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server already sets COOP/COEP headers via `vite.config.ts`.

> You need an Argent X or Braavos wallet on Starknet Sepolia to submit proofs. Proof *generation* works without a wallet.

---

### 2. Recompile Circuits (optional)

Only needed if you modify circuit logic. Compiled JSONs are already in `app/public/circuits/`.

```bash
# Install Noir 1.0.0-beta.16
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup --version 1.0.0-beta.16

cd circuits
nargo compile
```

Copy updated JSONs to the app:
```bash
cp circuits/balance/target/balance.json app/public/circuits/balance/target/
# repeat for each circuit
```

---

### 3. Build & Test Contracts (optional)

Only needed if you modify the Cairo contracts.

```bash
# Install Scarb
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Install snforge
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
snfoundryup --version 0.53.0

# Build
cd contracts/btc_proof_router
scarb build

# Test
snforge test
```

---

### 4. Build for Production

```bash
cd app
npm run build
# output in app/dist/
```

---

### 5. Deploy to Vercel

The repo is configured for Vercel deployment via `app/vercel.json`.

1. Import `0xZaid10/Privex` at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** to `app`
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

The COOP/COEP headers in `vercel.json` are critical — without them, bb.js WASM workers will fail in production.

---

## Toolchain Versions

```
Noir        1.0.0-beta.16+2d46fca7
bb.js       3.0.0-nightly.20251104
Garaga      1.0.1
Cairo       2.14.0
snforge     0.53.0
Node        ≥ 18
Starknet    ^9.4.2 (JS SDK)
```

---

## Roadmap

### Phase 1 — Mainnet & Stability
- **Bitcoin wallet signing** — cryptographic proof of address ownership before proof submission
- Deploy all 5 contracts to Starknet Mainnet
- Security audit of circuits and Cairo contracts
- Support for P2PKH, P2SH, P2WPKH address formats

### Phase 2 — Integrations & Access Control
- SDK for applications to accept Privex proofs as credentials
- NFT and airdrop gating by verified Bitcoin holdings
- DAO governance plugin — BTC-weighted voting without doxxing
- Community and platform access gating

### Phase 3 — Multi-Chain & Standards
- Proof verification on Ethereum L1 via EVM-compatible verifier
- Cross-chain proof relay — one proof, multiple networks
- Proof expiry and renewal system
- Open standard for Bitcoin ZK credentials

### Phase 4 — Ecosystem
- Developer API and SDK
- On-chain proof registry
- Bitcoin Lightning channel balance support
- Multisig and threshold signature wallet support

---

## Why Starknet

- **Native ZK** — Starknet is itself a ZK rollup. Verifying ZK proofs on Starknet is cheap and fast; the same operation on Ethereum L1 would cost hundreds of dollars
- **Garaga** — the Starknet ecosystem has Garaga, purpose-built for encoding and verifying Honk proofs on Cairo. This is what made on-chain Noir proof verification practical
- **Growing ecosystem** — the applications that will eventually integrate Privex credentials are being built on Starknet right now

---

## Networks

| Service | URL |
|---|---|
| Bitcoin data | `https://mempool.space/api/` |
| Starknet RPC | `https://starknet-sepolia.public.blastapi.io/rpc/v0_8` |
| Explorer | `https://sepolia.voyager.online` |

---

> **Prove what you own. Reveal nothing else.**
