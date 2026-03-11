/**
 * Report Page — Starknet BTC Proof Layer
 * Runs Balance + Historical proofs automatically and generates a report.
 *
 * Same WASM init pattern as main.ts.
 * Noir 1.0.0-beta.16 | bb.js 3.0.0-nightly | Garaga 1.0.1
 */

// ─────────────────────────────────────────────
// Render UI immediately — same pattern as main.ts
// ─────────────────────────────────────────────

document.getElementById("app")!.innerHTML = `
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    :root{--bg:#080808;--bg1:#0e0e0e;--bg2:#141414;--border:#1c1c1c;--border2:#303030;
      --text:#ffffff;--muted:#aaaaaa;--muted2:#666666;
      --orange:#f7931a;--oranged:#e8820a;--purple:#a78bfa;--purpled:#9061f9;--green:#4caf50;
      --fd:'Syne',sans-serif;--fm:'JetBrains Mono',monospace}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:var(--fm);font-size:14px;line-height:1.75;min-height:100vh;display:flex;flex-direction:column}
    body::before{content:'';position:fixed;inset:0;
      background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);
      background-size:56px 56px;opacity:.2;pointer-events:none;z-index:0}

    header{position:fixed;top:0;left:0;right:0;height:62px;display:flex;align-items:center;
      justify-content:space-between;padding:0 48px;
      background:rgba(8,8,8,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border-bottom:1px solid var(--border);z-index:200}
    .logo-wrap{display:flex;flex-direction:column;gap:1px;text-decoration:none}
    .logo{font-family:var(--fd);font-size:21px;font-weight:800;color:var(--orange);letter-spacing:-.5px}
    .logo-tag{font-size:9px;color:var(--muted2);letter-spacing:1.5px;text-transform:uppercase}
    nav{display:flex;gap:32px;position:absolute;left:50%;transform:translateX(-50%)}
    nav a{font-size:12px;color:var(--muted);text-decoration:none;letter-spacing:.4px;transition:color .18s;padding:4px 0;border-bottom:1px solid transparent}
    nav a:hover{color:var(--text)} nav a.active{color:var(--orange);border-bottom-color:var(--orange)}
    .hdr-right{display:flex;align-items:center;gap:10px}
    .waddr-hdr{font-size:11px;color:var(--muted)}
    .wbtn-hdr{font-family:var(--fm);font-size:12px;padding:7px 16px;background:transparent;
      color:var(--purple);border:1px solid rgba(167,139,250,.4);border-radius:3px;cursor:pointer;transition:all .18s}
    .wbtn-hdr:hover{background:var(--purple);color:#000;border-color:var(--purple)}
    .wbtn-hdr.on{color:var(--green);border-color:rgba(76,175,80,.4)}
    .wbtn-hdr.on:hover{background:var(--green);color:#000}

    .page{flex:1;position:relative;z-index:1;padding:96px 56px 56px;max-width:1100px;margin:0 auto;width:100%}
    .page-title{font-family:var(--fd);font-size:30px;font-weight:800;color:var(--text);letter-spacing:-.5px;margin-bottom:6px}
    .page-sub{font-size:12px;color:var(--muted);margin-bottom:32px;letter-spacing:.2px}
    #init-status{font-size:12px;color:var(--muted);margin-bottom:24px;padding:9px 14px;
      background:var(--bg1);border:1px solid var(--border);border-radius:3px;display:inline-block}
    #init-status.ready{display:none}
    #init-status.error{color:#f44336;border-color:rgba(244,67,54,.25);background:rgba(244,67,54,.04)}

    .panel{background:var(--bg1);border:1px solid var(--border);border-radius:4px;
      padding:28px 32px;margin-bottom:16px;transition:border-color .2s}
    .panel:hover{border-color:var(--border2)}
    .panel h2{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--orange);
      margin-bottom:8px;text-transform:uppercase;letter-spacing:1.2px}
    .panel p{font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.75}
    .row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:flex-end}
    .input-wrap{display:flex;flex-direction:column;gap:5px;flex:1;min-width:200px}
    .input-label{font-size:10px;color:var(--muted2);letter-spacing:1px;text-transform:uppercase}
    input{background:var(--bg2);border:1px solid var(--border2);color:var(--text);
      padding:10px 14px;font-family:var(--fm);font-size:13px;border-radius:3px;
      width:100%;transition:border-color .18s}
    input::placeholder{color:var(--muted2)}
    input:focus{outline:none;border-color:var(--orange)}
    .btns{display:flex;gap:10px;align-items:center;flex-shrink:0;padding-bottom:1px}
    button{background:var(--orange);color:#000;border:none;padding:10px 22px;
      font-family:var(--fm);font-size:12px;font-weight:500;border-radius:3px;
      cursor:pointer;transition:background .18s,transform .12s;white-space:nowrap}
    button:hover{background:var(--oranged);transform:translateY(-1px)}
    button:disabled{background:var(--border2);color:var(--muted2);cursor:not-allowed;transform:none}
    .btn-dl{background:var(--green);color:#000}
    .btn-dl:hover:not(:disabled){background:#43a047}
    .btn-priv{background:var(--purple);color:#000}
    .btn-priv:hover:not(:disabled){background:var(--purpled)}
    .log{background:#060606;border:1px solid var(--border);border-radius:3px;
      padding:14px 16px;font-size:12px;line-height:2;min-height:60px;
      white-space:pre-wrap;word-break:break-all;margin-top:14px;max-height:500px;overflow-y:auto}
    .ok{color:var(--green)} .err{color:#f44336} .info{color:var(--muted)}
    .step{color:var(--muted)} .sn{color:var(--purple)} .btc{color:var(--orange)}
    .div{color:#252525} .tx-link{color:var(--purple);text-decoration:underline;cursor:pointer}
    .hint{font-size:11px;color:var(--muted);margin-top:10px;line-height:1.7;font-style:italic}

    footer{position:relative;z-index:1;border-top:1px solid var(--border);
      padding:32px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
    .flogo{font-family:var(--fd);font-size:15px;font-weight:800;color:var(--orange);text-decoration:none}
    .fcopy{font-size:11px;color:var(--muted2);margin-top:4px}
    .flinks{display:flex;gap:24px}
    .flinks a{color:var(--muted);text-decoration:none;font-size:12px;transition:color .18s}
    .flinks a:hover{color:var(--text)}
    .fsoc{display:flex;gap:10px}
    .si-a{width:32px;height:32px;border:1px solid var(--border2);border-radius:3px;
      display:flex;align-items:center;justify-content:center;color:var(--muted);
      text-decoration:none;transition:all .18s;font-size:0}
    .si-a:hover{border-color:var(--muted);color:var(--text)}
    .si-a svg{width:14px;height:14px;fill:currentColor}

    @media(max-width:860px){nav{display:none}.page{padding:84px 24px 40px}
      header{padding:0 24px}footer{flex-direction:column;align-items:flex-start;padding:28px 24px}}
  </style>

  <header>
    <a href="/" class="logo-wrap">
      <span class="logo">Privex</span>
      <span class="logo-tag">Bitcoin · Zero Knowledge</span>
    </a>
    <nav>
      <a href="/">Home</a>
      <a href="/proof.html">Proof Engine</a>
      <a href="/report.html" class="active">Report</a>
    </nav>
    <div class="hdr-right">
      <span class="waddr-hdr" id="hdr-waddr"></span>
      <button class="wbtn-hdr" id="hdr-wbtn">Connect Wallet</button>
    </div>
  </header>

  <div class="page">
    <h1 class="page-title">Report Generator</h1>
    <p class="page-sub">Noir 1.0.0-beta.16 &middot; bb.js 3.0.0-nightly &middot; Garaga 1.0.1 &middot; UltraKeccakZKHonk</p>
    <p id="init-status">&#9203; Initialising WASM modules...</p>

    <div class="panel">
      <h2>&#128196; Generate Certificate</h2>
      <p>Proves Bitcoin balance and historical ownership on Starknet using zero-knowledge proofs. Your Bitcoin address is used locally to fetch on-chain data — it is never logged, stored, or transmitted to any server.</p>

      <div class="row">
        <div class="input-wrap" style="flex:2">
          <span class="input-label">Bitcoin Address</span>
          <input id="r-btcaddr" placeholder="bc1q... (local only — never leaves your browser)" />
        </div>
        <div class="input-wrap" style="max-width:180px">
          <span class="input-label">Threshold (BTC)</span>
          <input id="r-threshold" placeholder="e.g. 0.1" />
        </div>
        <div class="input-wrap" style="max-width:260px">
          <span class="input-label">Username (shown on Voyager)</span>
          <input id="r-username" placeholder="e.g. satoshi.btc" maxlength="31" />
        </div>
      </div>
      <p class="hint">Username is encoded as felt252 in TX calldata and emitted as a Starknet event — visible on the explorer. Your address and TX history will not appear in the report.</p>

      <div class="row" style="margin-top:18px;">
        <div class="btns">
          <button id="r-run-btn" disabled>&#9889; Run Both Proofs</button>
          <button id="r-dl-pub-btn" class="btn-dl" disabled>&#8595; Public Report</button>
          <button id="r-dl-priv-btn" class="btn-priv" disabled>&#8595; Private Report</button>
        </div>
      </div>

      <div class="log" id="r-log"><span class="info">Waiting for WASM init...</span></div>
    </div>

    <div class="panel" id="r-preview-panel" style="display:none;">
      <h2>&#128203; Report Preview</h2>
      <p>Public report is safe to share with anyone. Private report is for your own records only.</p>
      <div style="display:flex;gap:2px;margin-bottom:0;">
        <button id="tab-pub"  style="background:var(--green);color:#000;border-radius:3px 3px 0 0;padding:8px 18px;">Public</button>
        <button id="tab-priv" style="background:var(--border2);color:var(--muted);border-radius:3px 3px 0 0;padding:8px 18px;">Private</button>
      </div>
      <div class="log" id="r-preview-pub"  style="max-height:640px;font-size:11.5px;line-height:1.9;border-radius:0 3px 3px 3px;margin-top:0;"></div>
      <div class="log" id="r-preview-priv" style="max-height:640px;font-size:11.5px;line-height:1.9;border-radius:0 3px 3px 3px;margin-top:0;display:none;"></div>
    </div>
  </div>

  <footer>
    <div>
      <a href="/" class="flogo">Privex</a>
      <div class="fcopy">© 2026 Privex &middot; Starknet Sepolia Testnet</div>
    </div>
    <div class="flinks">
      <a href="/">Home</a>
      <a href="/proof.html">Proof Engine</a>
      <a href="/report.html">Report</a>
      <a href="https://sepolia.voyager.online/contract/0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2" target="_blank">Contract ↗</a>
    </div>
    <div class="fsoc">
      <a href="/" class="si-a" title="Website"><svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></a>
      <a href="https://x.com" target="_blank" class="si-a" title="X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
      <a href="https://github.com" target="_blank" class="si-a" title="GitHub"><svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg></a>
    </div>
  </footer>
`;

// ─────────────────────────────────────────────
// Helpers — identical pattern to main.ts
// ─────────────────────────────────────────────

function logger(id: string) {
  const el = document.getElementById(id)!;
  return {
    clear: () => { el.innerHTML = ""; },
    print: (msg: string, cls = "step") => {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = msg + "\n";
      el.appendChild(span);
      el.scrollTop = el.scrollHeight;
    },
    printLink: (msg: string, url: string) => {
      const span = document.createElement("span");
      span.className = "sn";
      span.textContent = msg + " ";
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.className = "tx-link";
      a.textContent = "View on Voyager ↗";
      span.appendChild(a);
      span.appendChild(document.createTextNode("\n"));
      el.appendChild(span);
      el.scrollTop = el.scrollHeight;
    },
  };
}

function disable(id: string, v: boolean) {
  (document.getElementById(id) as HTMLButtonElement).disabled = v;
}

function setStatus(msg: string, cls: "ready" | "error" | "") {
  const el = document.getElementById("init-status")!;
  el.textContent = msg;
  el.className = cls;
}

function isoDate(unixTs: number): string {
  return new Date(unixTs * 1000).toISOString()
    .replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function humanDuration(sinceUnix: number): string {
  const ms   = Date.now() - sinceUnix * 1000;
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000)  / 60000);
  if (days >= 365) {
    const yrs = Math.floor(days / 365);
    const rem = days % 365;
    return `${yrs} year${yrs !== 1 ? "s" : ""}, ${rem} day${rem !== 1 ? "s" : ""}`;
  }
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""}, ${hrs}h ${mins}m`;
  return `${hrs}h ${mins}m`;
}

function satsToBtc(sats: number): string {
  return (sats / 1e8).toFixed(8);
}

// ─────────────────────────────────────────────
// Report text builder
// ─────────────────────────────────────────────

interface ReportData {
  // NOTE: Bitcoin address is intentionally NOT stored here.
  // The whole point is zero-knowledge — the report proves facts
  // without revealing which address was used.
  username:        string;         // display name — public, shown on Voyager
  threshold:       number;
  sinceHeight:     number;
  generatedAt:     number;        // unix ts

  // Bitcoin on-chain — amounts and timestamps only, no address or txids
  currentBalance:  number;        // sats
  firstTxBlock:    number | null; // block number only, not hash or txid
  firstTxTs:       number | null; // unix
  holdDuration:    string | null;

  // Balance proof
  balVerified:     boolean;
  balTimingMs:     number;
  balPublicInputs: string[];
  balTxHash:       string | null;
  balBlockNum:     number | null;
  balBlockTs:      number | null;
  balFee:          string | null;

  // Historical proof
  histVerified:     boolean;
  histTimingMs:     number;
  histPublicInputs: string[];
  histTxHash:       string | null;
  histBlockNum:     number | null;
  histBlockTs:      number | null;
  histFee:          string | null;

  // Starknet block timestamps
  snBalBlockTs:    number | null;
  snHistBlockTs:   number | null;
}

// ─────────────────────────────────────────────
// PUBLIC report — shareable one-pager
// Only what a third-party verifier needs.
// No actual balance, no timing internals, no contract addresses.
// ─────────────────────────────────────────────

function buildPublicReport(d: ReportData): string {
  const L = "─".repeat(66);
  const D = "═".repeat(66);
  const now = isoDate(d.generatedAt);
  const lines: string[] = [];

  lines.push(D);
  lines.push("  BTC PROOF CERTIFICATE  —  PUBLIC");
  lines.push("  Starknet Sepolia  ·  Zero-Knowledge  ·  UltraKeccakZKHonk");
  lines.push(D);
  lines.push(`  Issued              : ${now}`);
  lines.push(`  Prover              : ${d.username || "(anonymous)"}`);
  lines.push(L);
  lines.push("");

  lines.push("  WHAT IS PROVEN");
  lines.push(L);
  lines.push(`  ✓ Controls a Bitcoin address with balance >= ${satsToBtc(d.threshold)} BTC`);
  if (d.firstTxTs) {
    lines.push(`  ✓ Has held that balance since ${isoDate(d.firstTxTs)}`);
    lines.push(`  ✓ Continuous holding duration: ${d.holdDuration}`);
  }
  lines.push(`  ✓ Both facts verified on-chain by a ZK verifier contract`);
  lines.push(`  ✓ Bitcoin address is intentionally not revealed`);
  lines.push(L);
  lines.push("");

  lines.push("  ON-CHAIN VERIFICATION");
  lines.push(L);
  if (d.balTxHash) {
    lines.push(`  Balance proof TX    : ${d.balTxHash}`);
    lines.push(`  Explorer            : https://sepolia.voyager.online/tx/${d.balTxHash}`);
  }
  if (d.histTxHash) {
    lines.push(`  Historical proof TX : ${d.histTxHash}`);
    lines.push(`  Explorer            : https://sepolia.voyager.online/tx/${d.histTxHash}`);
  }
  lines.push(`  Prover username     : "${d.username || "(anonymous)"}" — visible in TX events`);
  lines.push(L);
  lines.push("");

  lines.push("  HOW TO VERIFY");
  lines.push(L);
  lines.push("  1. Open the TX links above on Voyager.");
  lines.push("  2. Go to the Events tab — find the ProofVerified event.");
  lines.push(`  3. Confirm username = "${d.username || "(anonymous)"}" and commitment matches.`);
  lines.push("  4. The TX being accepted on-chain means the ZK proof is valid.");
  lines.push("  5. No trust required — verification is fully on-chain.");
  lines.push(D);

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// PRIVATE report — full technical detail
// For the prover's own records.
// ─────────────────────────────────────────────

function buildPrivateReport(d: ReportData): string {
  const L  = "─".repeat(66);
  const D  = "═".repeat(66);
  const now = isoDate(d.generatedAt);

  const lines: string[] = [];

  lines.push(D);
  lines.push("  BTC PROOF CERTIFICATE  —  PRIVATE  (do not share)");
  lines.push("  Starknet Sepolia  ·  Noir 1.0.0-beta.16  ·  Garaga 1.0.1");
  lines.push(D);
  lines.push(`  Generated at      : ${now}`);
  lines.push(`  Prover username   : ${d.username || "(anonymous)"}`);
  lines.push(`  Bitcoin Address   : [withheld — zero-knowledge proof]`);
  lines.push(`  Threshold proven  : >= ${satsToBtc(d.threshold)} BTC`);
  lines.push(`  Historical since  : block ${d.sinceHeight.toLocaleString()}`);
  lines.push(`  ZK System         : UltraKeccakZKHonk  (bb.js 3.0.0-nightly)`);
  lines.push(`  Router Contract   : 0x002b84348549bdbdac2e9de4176ea15740ac5b64bd22310be38176fdf0cb3ff2`);
  lines.push(L);
  lines.push("");

  lines.push("  IDENTITY CHAIN");
  lines.push(L);
  lines.push(`  1. Username "${d.username || "(anonymous)"}" is encoded as felt252 in TX calldata.`);
  lines.push(`  2. Emitted as a ProofVerified event on Starknet — visible on Voyager.`);
  lines.push(`  3. The event contains the ZK commitment from the proof public inputs.`);
  lines.push(`  4. The commitment cryptographically binds username to the Bitcoin UTXO set.`);
  lines.push(`  5. The Starknet TX is signed by the prover's wallet — links username to wallet.`);
  lines.push(`  To verify: Voyager TX → Events tab → username + commitment.`);
  lines.push(L);
  lines.push("");

  lines.push("  BITCOIN HOLDINGS  (private)");
  lines.push(L);
  lines.push(`  Balance proven    : >= ${satsToBtc(d.threshold)} BTC  (ZK threshold)`);
  lines.push(`  Actual balance    : ${satsToBtc(d.currentBalance)} BTC  (not revealed on-chain)`);
  if (d.firstTxBlock) lines.push(`  Held since block  : ${d.firstTxBlock.toLocaleString()}`);
  if (d.firstTxTs)    lines.push(`  Held since date   : ${isoDate(d.firstTxTs)}`);
  if (d.holdDuration) lines.push(`  Duration held     : ${d.holdDuration}`);
  lines.push(`  Note              : Address and TX IDs withheld — provable via ZK only`);
  lines.push(L);
  lines.push("");

  lines.push("  PROOF #1  —  BALANCE THRESHOLD");
  lines.push(L);
  lines.push(`  Circuit           : balance  (Noir 1.0.0-beta.16)`);
  lines.push(`  Locally Verified  : ${d.balVerified ? "YES ✓" : "NO ✗"}`);
  lines.push(`  Proof Time        : ${(d.balTimingMs / 1000).toFixed(1)}s`);
  lines.push(`    [0] threshold   : ${satsToBtc(d.threshold)} BTC  (${d.threshold.toLocaleString()} sat)`);
  lines.push(`    [1] commitment  : ${d.balPublicInputs[1] ?? "—"}`);
  if (d.balTxHash) {
    lines.push(`  Starknet TX       : ${d.balTxHash}`);
    lines.push(`  TX Link           : https://sepolia.voyager.online/tx/${d.balTxHash}`);
  }
  if (d.balBlockNum)  lines.push(`  Included Block    : ${d.balBlockNum.toLocaleString()}`);
  if (d.snBalBlockTs) lines.push(`  Block Timestamp   : ${isoDate(d.snBalBlockTs)}`);
  if (d.balFee)       lines.push(`  Actual Fee        : ${d.balFee} STRK`);
  lines.push(`  Verifier Contract : 0x0488037e3063230e59180cc4d02f37a2e363cf9fd77068b82aec35fc4d5ba034`);
  lines.push(L);
  lines.push("");

  lines.push("  PROOF #2  —  HISTORICAL OWNERSHIP");
  lines.push(L);
  lines.push(`  Circuit           : historical  (Noir 1.0.0-beta.16)`);
  lines.push(`  Since Block       : ${d.sinceHeight.toLocaleString()}`);
  lines.push(`  Locally Verified  : ${d.histVerified ? "YES ✓" : "NO ✗"}`);
  lines.push(`  Proof Time        : ${(d.histTimingMs / 1000).toFixed(1)}s`);
  lines.push(`    [0] threshold   : ${satsToBtc(d.threshold)} BTC  (${d.threshold.toLocaleString()} sat)`);
  lines.push(`    [1] since_block : ${d.sinceHeight.toLocaleString()}`);
  const histCommitment = d.histPublicInputs[d.histPublicInputs.length - 1] ?? "—";
  lines.push(`    [N] commitment  : ${histCommitment}`);
  if (d.histTxHash) {
    lines.push(`  Starknet TX       : ${d.histTxHash}`);
    lines.push(`  TX Link           : https://sepolia.voyager.online/tx/${d.histTxHash}`);
  }
  if (d.histBlockNum)  lines.push(`  Included Block    : ${d.histBlockNum.toLocaleString()}`);
  if (d.snHistBlockTs) lines.push(`  Block Timestamp   : ${isoDate(d.snHistBlockTs)}`);
  if (d.histFee)       lines.push(`  Actual Fee        : ${d.histFee} STRK`);
  lines.push(`  Verifier Contract : 0x019e6d977cf438c87105ba49dff541d7442a9a22469687f3d4176bdd0fbb378c`);
  lines.push(L);
  lines.push("");

  lines.push("  WHAT THIS CERTIFICATE PROVES");
  lines.push(L);
  lines.push("  1. The prover controls a Bitcoin address with balance >= threshold.");
  lines.push("  2. That address held >= threshold since the stated block height.");
  lines.push("  3. Both facts were verified by a Garaga ZK verifier on Starknet.");
  lines.push("");
  lines.push("  WHAT THIS CERTIFICATE DOES NOT REVEAL");
  lines.push(L);
  lines.push("  - The Bitcoin address (withheld by design)");
  lines.push("  - Any transaction IDs linked to the address");
  lines.push("  - The exact balance (only that it exceeds the threshold)");
  lines.push("  - Any other UTXOs or transaction history");
  lines.push("");
  lines.push("  TECHNICAL");
  lines.push(L);
  lines.push("  Proofs generated in-browser via Noir + bb.js. No private keys or");
  lines.push("  addresses were transmitted to any server at any point. On-chain");
  lines.push("  verification uses Garaga's UltraKeccakZKHonk verifier contracts.");
  lines.push(D);

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// Report preview renderer (colourised)
// ─────────────────────────────────────────────

function renderToLog(text: string, logId: string): void {
  const log = logger(logId);
  log.clear();
  for (const line of text.split("\n")) {
    const t = line.trim();
    let cls = "step";
    if (t.startsWith("═") || t.startsWith("─"))          cls = "div";
    else if (t.includes("voyager.online"))                cls = "sn";
    else if (t.startsWith("Starknet TX") ||
             t.startsWith("Balance proof TX") ||
             t.startsWith("Historical proof TX"))         cls = "sn";
    else if (t.startsWith("Balance proven") ||
             t.startsWith("Actual balance") ||
             t.startsWith("Held since") ||
             t.startsWith("Duration") ||
             t.startsWith("✓ Controls") ||
             t.startsWith("✓ Has held") ||
             t.startsWith("✓ Continuous"))               cls = "btc";
    else if (t.startsWith("Locally Verified") ||
             t.startsWith("Issued") ||
             t.startsWith("Generated") ||
             t.startsWith("✓ Both facts") ||
             t.startsWith("✓ Bitcoin address"))          cls = "ok";
    else if (t.includes("PRIVATE") || t.startsWith("Note"))  cls = "err";
    log.print(line, cls);
  }
}

// ─────────────────────────────────────────────
// Starknet RPC helper — get TX receipt for fee + block
// ─────────────────────────────────────────────

async function getReceiptInfo(txHash: string): Promise<{
  blockNum: number | null;
  blockTs:  number | null;
  fee:      string | null;
}> {
  const RPC_URL = "https://starknet-sepolia.public.blastapi.io/rpc/v0_8";
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "starknet_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const j = await res.json();
    const receipt = j.result;
    const blockNum = receipt?.block_number ?? null;

    let blockTs: number | null = null;
    if (blockNum) {
      const r2 = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2,
          method: "starknet_getBlockWithTxHashes",
          params: [{ block_number: blockNum }],
        }),
      });
      const j2 = await r2.json();
      blockTs = j2.result?.timestamp ?? null;
    }

    const rawFee = receipt?.actual_fee?.amount;
    const fee = rawFee ? (Number(BigInt(rawFee)) / 1e15).toFixed(4) : null;

    return { blockNum, blockTs, fee };
  } catch { return { blockNum: null, blockTs: null, fee: null }; }
}

// ─────────────────────────────────────────────
// Mempool.space helpers
// ─────────────────────────────────────────────

async function getBtcAddressInfo(address: string): Promise<{
  balance: number;
  firstTxBlock:    number | null;
  firstTxTs:       number | null;
  firstTxId:       string | null;
  oldestUtxoBlock: number | null;
}> {
  const base = "https://mempool.space/api";

  const infoRes = await fetch(`${base}/address/${address}`);
  if (!infoRes.ok) throw new Error(`mempool.space address lookup failed: ${infoRes.status}`);
  const info = await infoRes.json();

  const balance = info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;

  // Fetch TXs for first-TX metadata (holding duration display)
  const txsRes = await fetch(`${base}/address/${address}/txs`);
  const txs: any[] = txsRes.ok ? await txsRes.json() : [];
  const confirmedTxs = txs.filter((t: any) => t.status?.confirmed);
  confirmedTxs.sort((a: any, b: any) => (a.status.block_height ?? 0) - (b.status.block_height ?? 0));

  const oldest = confirmedTxs[0] ?? null;
  let firstTxBlock: number | null = oldest?.status?.block_height ?? null;
  let firstTxTs:    number | null = oldest?.status?.block_time   ?? null;
  const firstTxId:  string | null = oldest?.txid ?? null;

  if (firstTxBlock && !firstTxTs) {
    try {
      const bhRes = await fetch(`${base}/block-height/${firstTxBlock}`);
      const hash  = (await bhRes.text()).trim();
      const bRes  = await fetch(`${base}/block/${hash}`);
      const bData = await bRes.json();
      firstTxTs = bData.timestamp ?? null;
    } catch { /* leave null */ }
  }

  // Fetch UTXOs separately — circuit filters on UTXO block_height, not TX block_height
  // oldestUtxoBlock = the sinceHeight we pass to generateHistoricalProof
  const utxoRes = await fetch(`${base}/address/${address}/utxo`);
  const utxos: any[] = utxoRes.ok ? await utxoRes.json() : [];
  const confirmedUtxos = utxos.filter((u: any) => u.status?.confirmed && u.status?.block_height);
  confirmedUtxos.sort((a: any, b: any) => a.status.block_height - b.status.block_height);
  const oldestUtxoBlock: number | null = confirmedUtxos[0]?.status?.block_height ?? null;

  return { balance, firstTxBlock, firstTxTs, firstTxId, oldestUtxoBlock };
}

// ─────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────

function downloadTxt(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ─────────────────────────────────────────────
// Main async init — identical pattern to main.ts
// ─────────────────────────────────────────────

async function init() {
  try {
    setStatus("⏳ Initialising Noir WASM...", "");

    const [initACVM, initNoirC, acvmWasm, noircWasm] = await Promise.all([
      import("@noir-lang/acvm_js").then(m => m.default),
      import("@noir-lang/noirc_abi").then(m => m.default),
      import("@noir-lang/acvm_js/web/acvm_js_bg.wasm?url").then(m => m.default),
      import("@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url").then(m => m.default),
    ]);

    await Promise.all([
      initACVM(fetch(acvmWasm)),
      initNoirC(fetch(noircWasm)),
    ]);

    setStatus("⏳ Initialising Garaga WASM...", "");
    const { initGaraga, submitToStarknet, STARKNET_CONTRACTS } = await import("./prover");
    await initGaraga();

    const { generateBalanceProof, generateHistoricalProof } = await import("./index");

    setStatus("✓ Ready — all WASM modules loaded", "ready");
    disable("r-run-btn", false);
    const log = logger("r-log");
    log.clear();

    // ── Header wallet button ─────────────────────────────────────────
    function getInjectedWallet() {
      const win = window as any;
      return win['starknet_argentX'] ?? win['starknet_braavos'] ?? win.starknet ?? null;
    }
    async function connectHeaderWallet() {
      const hdrBtn = document.getElementById("hdr-wbtn") as HTMLButtonElement;
      const hdrAddr = document.getElementById("hdr-waddr")!;
      const inj = getInjectedWallet();
      if (!inj) { hdrBtn.textContent = "No wallet found"; return; }
      try {
        hdrBtn.textContent = "Connecting..."; hdrBtn.disabled = true;
        const accounts: string[] = await inj.request({ type: "wallet_requestAccounts", params: { silent_mode: false } });
        const addr = accounts?.[0] ?? "";
        if (!addr) throw new Error("No accounts");
        const short = addr.slice(0,6) + "..." + addr.slice(-4);
        hdrBtn.textContent = "Connected"; hdrBtn.classList.add("on");
        hdrAddr.textContent = short; hdrBtn.disabled = false;
      } catch { hdrBtn.textContent = "Connect Wallet"; hdrBtn.disabled = false; }
    }
    document.getElementById("hdr-wbtn")!.addEventListener("click", connectHeaderWallet);
    // Auto-detect
    const _inj = getInjectedWallet();
    if (_inj?.isConnected || _inj?.selectedAddress) {
      const addr = _inj.selectedAddress ?? _inj.account?.address ?? "";
      if (addr) {
        const hdrBtn = document.getElementById("hdr-wbtn") as HTMLButtonElement;
        hdrBtn.textContent = "Connected"; hdrBtn.classList.add("on");
        document.getElementById("hdr-waddr")!.textContent = addr.slice(0,6)+"..."+addr.slice(-4);
      }
    }

    // ── Report state ────────────────────────────────────────────────
    let pubReportText  = "";
    let privReportText = "";

    // ── Run handler ─────────────────────────────────────────────────
    document.getElementById("r-run-btn")!.addEventListener("click", async () => {
      const btcAddr    = (document.getElementById("r-btcaddr")   as HTMLInputElement).value.trim();
      const threshBtc  = parseFloat((document.getElementById("r-threshold") as HTMLInputElement).value.trim());
      const username   = (document.getElementById("r-username")  as HTMLInputElement).value.trim().slice(0, 31);

      if (!btcAddr) {
        logger("r-log").clear();
        logger("r-log").print("✗ Bitcoin address is required.", "err");
        return;
      }
      if (isNaN(threshBtc) || threshBtc <= 0) {
        logger("r-log").clear();
        logger("r-log").print("✗ Threshold must be a positive BTC value (e.g. 0.2).", "err");
        return;
      }

      // Convert BTC → satoshis for all circuit calls
      const threshold = Math.round(threshBtc * 1e8);

      const log = logger("r-log");
      log.clear();
      disable("r-run-btn",     true);
      disable("r-dl-pub-btn",  true);
      disable("r-dl-priv-btn", true);
      pubReportText  = "";
      privReportText = "";
      document.getElementById("r-preview-panel")!.style.display = "none";

      // Partial report data — address intentionally excluded
      const report: Partial<ReportData> = {
        username,
        threshold,
        sinceHeight: 0,   // filled after UTXO fetch
        generatedAt: Math.floor(Date.now() / 1000),
      };

      // Shared progress filter — same as main.ts
      function friendly(raw: string): string | null {
        const s = raw.toLowerCase();
        if (s.includes("salt") || s.includes("commitment") || s.includes("witness") ||
            s.includes("verification key") || s.includes("vk") || s.includes("calldata") ||
            s.includes("garaga") || s.includes("building") || s.includes("sent:") ||
            s.includes("transaction sent")) return null;
        if (s.includes("fetching") || s.includes("utxo") || s.includes("mempool"))
          return "Fetching Bitcoin data...";
        if (s.includes("loading circuit")) return "Loading proof circuit...";
        if (s.includes("initialising")) return "Initialising cryptographic backend...";
        if (s.includes("generating zk") || s.includes("generating proof"))
          return "Generating zero-knowledge proof  (this takes ~15s)...";
        if (s.includes("verifying")) return "Verifying proof locally...";
        if (s.includes("connecting")) return "Connecting to wallet...";
        if (s.includes("sending")) return "Submitting to Starknet...";
        return null;
      }
      const shownMsgs = new Set<string>();
      const prog = (raw: string) => {
        const m = friendly(raw);
        if (!m || shownMsgs.has(m)) return;
        shownMsgs.add(m);
        log.print(m, "step");
      };

      try {
        // ── Step 1: Bitcoin on-chain data ─────────────────────────
        log.print("Fetching Bitcoin balance from mempool...", "step");
        const btcInfo = await getBtcAddressInfo(btcAddr);
        report.currentBalance = btcInfo.balance;
        report.firstTxBlock   = btcInfo.firstTxBlock;
        report.firstTxTs      = btcInfo.firstTxTs;
        report.holdDuration   = btcInfo.firstTxTs ? humanDuration(btcInfo.firstTxTs) : null;

        log.print(`  Balance  ${satsToBtc(btcInfo.balance)} BTC`, "btc");
        if (btcInfo.firstTxTs) {
          log.print(`  Held since  block ${btcInfo.firstTxBlock}  (${report.holdDuration})`, "btc");
        }

        if (!btcInfo.oldestUtxoBlock) {
          throw new Error("No confirmed UTXOs found — cannot run historical proof.");
        }
        const sinceHeight = btcInfo.oldestUtxoBlock;
        report.sinceHeight = sinceHeight;

        // ── Step 2: Balance proof ─────────────────────────────────
        log.print("", "div");
        log.print("Proving balance threshold...", "step");
        shownMsgs.clear();

        const balResult = await generateBalanceProof(btcAddr, threshold, prog);

        report.balVerified     = balResult.verified;
        report.balTimingMs     = balResult.timingMs;
        report.balPublicInputs = balResult.package.publicInputs;

        const balSecs = (balResult.timingMs / 1000).toFixed(1);
        if (balResult.verified) {
          log.print(`✓ Balance proof verified  ·  ${balSecs}s`, "ok");
        } else {
          log.print(`✗ Balance proof failed`, "err");
        }

        // ── Step 3: Submit balance proof ──────────────────────────
        log.print("Submitting to Starknet...", "sn");
        try {
          shownMsgs.clear();
          const balSn = await submitToStarknet(balResult.package, prog, username, STARKNET_CONTRACTS.routerV2);
          report.balTxHash = balSn.txHash;
          const balShort = balSn.txHash.slice(0,10) + "…" + balSn.txHash.slice(-6);
          log.print(`✓ Proof accepted on-chain`, "ok");
          log.printLink(`  TX  ${balShort}`, balSn.explorerUrl);

          const balReceipt = await getReceiptInfo(balSn.txHash);
          report.balBlockNum  = balReceipt.blockNum;
          report.snBalBlockTs = balReceipt.blockTs;
          report.balFee       = balReceipt.fee;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          log.print(`✗ Submit failed: ${msg}`, "err");
          report.balTxHash = null;
        }

        // ── Step 4: Historical proof ──────────────────────────────
        log.print("", "div");
        log.print(`Proving historical ownership since block ${sinceHeight}...`, "step");
        shownMsgs.clear();

        const histResult = await generateHistoricalProof(btcAddr, threshold, sinceHeight, prog);

        report.histVerified     = histResult.verified;
        report.histTimingMs     = histResult.timingMs;
        report.histPublicInputs = histResult.package.publicInputs;

        const histSecs = (histResult.timingMs / 1000).toFixed(1);
        if (histResult.verified) {
          log.print(`✓ Historical proof verified  ·  ${histSecs}s`, "ok");
        } else {
          log.print(`✗ Historical proof failed`, "err");
        }

        // ── Step 5: Submit historical proof ───────────────────────
        log.print("Submitting to Starknet...", "sn");
        try {
          shownMsgs.clear();
          const histSn = await submitToStarknet(histResult.package, prog, username, STARKNET_CONTRACTS.routerV2);
          report.histTxHash = histSn.txHash;
          const histShort = histSn.txHash.slice(0,10) + "…" + histSn.txHash.slice(-6);
          log.print(`✓ Proof accepted on-chain`, "ok");
          log.printLink(`  TX  ${histShort}`, histSn.explorerUrl);

          const histReceipt = await getReceiptInfo(histSn.txHash);
          report.histBlockNum  = histReceipt.blockNum;
          report.snHistBlockTs = histReceipt.blockTs;
          report.histFee       = histReceipt.fee;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          log.print(`✗ Submit failed: ${msg}`, "err");
          report.histTxHash = null;
        }

        // ── Step 6: Build reports ─────────────────────────────────
        pubReportText  = buildPublicReport(report as ReportData);
        privReportText = buildPrivateReport(report as ReportData);

        renderToLog(pubReportText,  "r-preview-pub");
        renderToLog(privReportText, "r-preview-priv");

        document.getElementById("r-preview-panel")!.style.display = "block";
        disable("r-dl-pub-btn",  false);
        disable("r-dl-priv-btn", false);

        log.print("", "div");
        log.print("✓ Both proofs complete — reports ready below.", "ok");

        document.getElementById("r-preview-panel")!.scrollIntoView({ behavior: "smooth", block: "start" });

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.print(`✗ ${msg}`, "err");
      } finally {
        disable("r-run-btn", false);
      }
    });

    // ── Download handlers ──────────────────────────────────────────
    document.getElementById("r-dl-pub-btn")!.addEventListener("click", () => {
      if (pubReportText) downloadTxt(pubReportText, `btc-proof-PUBLIC-${Date.now()}.txt`);
    });
    document.getElementById("r-dl-priv-btn")!.addEventListener("click", () => {
      if (privReportText) downloadTxt(privReportText, `btc-proof-PRIVATE-${Date.now()}.txt`);
    });

    // ── Tab switchers ──────────────────────────────────────────────
    document.getElementById("tab-pub")!.addEventListener("click", () => {
      document.getElementById("r-preview-pub")!.style.display  = "block";
      document.getElementById("r-preview-priv")!.style.display = "none";
      (document.getElementById("tab-pub")  as HTMLButtonElement).style.background = "#4caf50";
      (document.getElementById("tab-pub")  as HTMLButtonElement).style.color      = "#000";
      (document.getElementById("tab-priv") as HTMLButtonElement).style.background = "#2a2a2a";
      (document.getElementById("tab-priv") as HTMLButtonElement).style.color      = "#555";
    });
    document.getElementById("tab-priv")!.addEventListener("click", () => {
      document.getElementById("r-preview-pub")!.style.display  = "none";
      document.getElementById("r-preview-priv")!.style.display = "block";
      (document.getElementById("tab-priv") as HTMLButtonElement).style.background = "#a78bfa";
      (document.getElementById("tab-priv") as HTMLButtonElement).style.color      = "#000";
      (document.getElementById("tab-pub")  as HTMLButtonElement).style.background = "#2a2a2a";
      (document.getElementById("tab-pub")  as HTMLButtonElement).style.color      = "#555";
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(`✗ Init failed: ${msg}`, "error");
    console.error("Init error:", e);
  }
}

init();
