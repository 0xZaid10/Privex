/**
 * Dev Test UI -- Starknet BTC Proof Layer
 * Noir 1.0.0-beta.16 | bb.js 3.0.0-nightly | Garaga 1.0.1
 */

// ─────────────────────────────────────────────
// Render UI immediately — before any async imports
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

    /* header */
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

    /* page */
    .page{flex:1;position:relative;z-index:1;padding:96px 56px 56px;max-width:1100px;margin:0 auto;width:100%}
    .page-title{font-family:var(--fd);font-size:30px;font-weight:800;color:var(--text);letter-spacing:-.5px;margin-bottom:6px}
    .page-sub{font-size:12px;color:var(--muted);margin-bottom:32px;letter-spacing:.2px}

    /* init status — only shown during loading / error, hidden when ready */
    #init-status{font-size:12px;color:var(--muted);margin-bottom:24px;padding:9px 14px;
      background:var(--bg1);border:1px solid var(--border);border-radius:3px;display:inline-block}
    #init-status.ready{display:none}
    #init-status.error{color:#f44336;border-color:rgba(244,67,54,.25);background:rgba(244,67,54,.04)}

    /* panels */
    .panel{background:var(--bg1);border:1px solid var(--border);border-radius:4px;
      padding:28px 32px;margin-bottom:16px;transition:border-color .2s}
    .panel:hover{border-color:var(--border2)}
    .panel h2{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--orange);
      margin-bottom:8px;text-transform:uppercase;letter-spacing:1.2px}
    .panel p{font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.75}
    .row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
    .input-wrap{display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px}
    .input-label{font-size:10px;color:var(--muted2);letter-spacing:1px;text-transform:uppercase}
    input{background:var(--bg2);border:1px solid var(--border2);color:var(--text);
      padding:10px 14px;font-family:var(--fm);font-size:13px;border-radius:3px;
      width:100%;transition:border-color .18s}
    input::placeholder{color:var(--muted2)}
    input:focus{outline:none;border-color:var(--orange)}
    .btns{display:flex;gap:10px;align-items:center;margin-top:4px;flex-shrink:0}
    button{background:var(--orange);color:#000;border:none;padding:10px 22px;
      font-family:var(--fm);font-size:12px;font-weight:500;border-radius:3px;
      cursor:pointer;transition:background .18s,transform .12s;white-space:nowrap}
    button:hover{background:var(--oranged);transform:translateY(-1px)}
    button:disabled{background:var(--border2);color:var(--muted2);cursor:not-allowed;transform:none}
    .btn-sn{background:var(--purple);color:#000}
    .btn-sn:hover:not(:disabled){background:var(--purpled)}

    /* log */
    .log{background:#060606;border:1px solid var(--border);border-radius:3px;
      padding:14px 16px;font-size:12px;line-height:2;min-height:60px;
      white-space:pre-wrap;word-break:break-all;margin-top:14px;max-height:440px;overflow-y:auto}
    .ok{color:var(--green)} .err{color:#f44336} .info{color:var(--muted)}
    .step{color:var(--muted)} .sn{color:var(--purple)} .div{color:#252525}
    .tx-link{color:var(--purple);text-decoration:underline;cursor:pointer}
    .wallet-connected{color:var(--green)!important}
    #wallet-status{font-size:12px;color:var(--muted);align-self:center;margin-left:6px}

    /* footer */
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
      <a href="/proof.html" class="active">Proof Engine</a>
      <a href="/report.html">Report</a>
    </nav>
    <div class="hdr-right">
      <span class="waddr-hdr" id="hdr-waddr"></span>
      <button class="wbtn-hdr" id="hdr-wbtn">Connect Wallet</button>
    </div>
  </header>

  <div class="page">
    <h1 class="page-title">Proof Engine</h1>
    <p class="page-sub">Noir 1.0.0-beta.16 &middot; bb.js 3.0.0-nightly &middot; Garaga 1.0.1 &middot; UltraKeccakZKHonk</p>
    <p id="init-status">&#9203; Initialising WASM modules...</p>

    <div class="panel" id="wallet-panel">
      <h2>&#127760; Starknet Wallet</h2>
      <p>Connect your Argent X or Braavos wallet to submit proofs on-chain. Must be on Sepolia testnet.</p>
      <div class="row">
        <div class="btns">
          <button id="wallet-btn">Connect Wallet</button>
          <span id="wallet-status">Not connected</span>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>01 &mdash; Balance Threshold</h2>
      <p>Prove you hold &ge; a BTC threshold. Generates a UltraKeccakZKHonk proof verified on Starknet.</p>
      <div class="row">
        <div class="input-wrap" style="flex:2">
          <span class="input-label">Bitcoin Address</span>
          <input id="b-address" placeholder="bc1q..." />
        </div>
        <div class="input-wrap" style="max-width:180px">
          <span class="input-label">Threshold (BTC)</span>
          <input id="b-threshold" placeholder="e.g. 0.1" />
        </div>
        <div class="btns">
          <button id="b-btn" disabled>Prove</button>
          <button id="b-sn-btn" class="btn-sn" disabled>Submit</button>
        </div>
      </div>
      <div class="log" id="b-log"><span class="info">Waiting for WASM init...</span></div>
    </div>

    <div class="panel">
      <h2>02 &mdash; Multi-Address Balance</h2>
      <p>Prove combined balance across up to 8 addresses &ge; a threshold.</p>
      <div class="row">
        <div class="input-wrap">
          <span class="input-label">Address 1</span>
          <input id="ma-addr1" placeholder="bc1q..." />
        </div>
        <div class="input-wrap">
          <span class="input-label">Address 2 (optional)</span>
          <input id="ma-addr2" placeholder="bc1q..." />
        </div>
      </div>
      <div class="row">
        <div class="input-wrap" style="max-width:180px">
          <span class="input-label">Combined Threshold (BTC)</span>
          <input id="ma-threshold" placeholder="e.g. 0.5" />
        </div>
        <div class="btns">
          <button id="ma-btn" disabled>Prove</button>
          <button id="ma-sn-btn" class="btn-sn" disabled>Submit</button>
        </div>
      </div>
      <div class="log" id="ma-log"><span class="info">Waiting for WASM init...</span></div>
    </div>

    <div class="panel">
      <h2>03 &mdash; Historical Ownership</h2>
      <p>Prove you held &ge; a BTC threshold since a specific block. Verifies 8 consecutive Bitcoin block headers.</p>
      <div class="row">
        <div class="input-wrap" style="flex:2">
          <span class="input-label">Bitcoin Address</span>
          <input id="h-address" placeholder="bc1q..." />
        </div>
        <div class="input-wrap" style="max-width:180px">
          <span class="input-label">Since Block Height</span>
          <input id="h-height" placeholder="e.g. 840000" />
        </div>
        <div class="input-wrap" style="max-width:180px">
          <span class="input-label">Threshold (BTC)</span>
          <input id="h-threshold" placeholder="e.g. 0.1" />
        </div>
        <div class="btns">
          <button id="h-btn" disabled>Prove</button>
          <button id="h-sn-btn" class="btn-sn" disabled>Submit</button>
        </div>
      </div>
      <div class="log" id="h-log"><span class="info">Waiting for WASM init...</span></div>
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
// Helpers
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
      a.href = url;
      a.target = "_blank";
      a.className = "tx-link";
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

// Store last proof package per circuit for Starknet submission
const lastProof: Record<string, any> = {};

// ── Progress message filter — maps raw internal strings to friendly UI messages
// Returns null to suppress the message entirely
function friendlyProgress(raw: string): { msg: string; cls: string } | null {
  const s = raw.toLowerCase();
  // Suppress purely technical noise
  if (s.includes("salt") || s.includes("commitment") || s.includes("witness") ||
      s.includes("verification key") || s.includes("vk") ||
      s.includes("calldata") || s.includes("garaga") ||
      s.includes("acvm") || s.includes("bb.js") ||
      s.includes("building calldata") || s.includes("sent:") ||
      s.includes("transaction sent:")) return null;

  // Map to clean messages
  if (s.includes("fetching") || s.includes("utxo") || s.includes("mempool"))
    return { msg: "Fetching Bitcoin balance from mempool...", cls: "step" };
  if (s.includes("loading circuit"))
    return { msg: "Loading proof circuit...", cls: "step" };
  if (s.includes("initialising noir") || s.includes("initialising barretenberg") || s.includes("initialising"))
    return { msg: "Initialising cryptographic backend...", cls: "step" };
  if (s.includes("generating zk proof") || s.includes("generating proof"))
    return { msg: "Generating zero-knowledge proof  (this takes ~15s)...", cls: "step" };
  if (s.includes("verifying"))
    return { msg: "Verifying proof locally...", cls: "step" };
  if (s.includes("encoding") || s.includes("starknet"))
    return { msg: "Preparing Starknet transaction...", cls: "step" };
  if (s.includes("connecting"))
    return { msg: "Connecting to wallet...", cls: "step" };
  if (s.includes("sending"))
    return { msg: "Submitting to Starknet...", cls: "sn" };

  // Pass through anything else suppressed by default
  return null;
}

async function runProof(
  btnId: string,
  snBtnId: string,
  logId: string,
  circuitKey: string,
  fn: (p: (s: string) => void) => Promise<any>
) {
  const log = logger(logId);
  log.clear();
  disable(btnId, true);
  disable(snBtnId, true);

  // Deduplicate — only show each unique friendly message once
  const shown = new Set<string>();
  const progress = (raw: string) => {
    const mapped = friendlyProgress(raw);
    if (!mapped) return;
    if (shown.has(mapped.msg)) return;
    shown.add(mapped.msg);
    log.print(mapped.msg, mapped.cls);
  };

  try {
    const r = await fn(progress);
    lastProof[circuitKey] = r.package;
    const secs = (r.timingMs / 1000).toFixed(1);
    log.print("", "div"); // spacer
    log.print(`✓ Proof verified locally  ·  ${secs}s`, "ok");

    // Show commitment (last public input) as the "proof fingerprint"
    const pis: string[] = r.package.publicInputs;
    if (pis.length > 0) {
      const commitment = pis[pis.length - 1];
      const short = commitment.slice(0, 12) + "…" + commitment.slice(-8);
      log.print(`  Commitment  ${short}`, "sn");
    }
    log.print(`  Ready to submit →`, "sn");
    disable(snBtnId, false);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.print(`✗ ${msg}`, "err");
  } finally {
    disable(btnId, false);
  }
}

async function runSubmit(
  snBtnId: string,
  logId: string,
  circuitKey: string,
  submitFn: (pkg: any, progress: (s: string) => void) => Promise<any>
) {
  const log = logger(logId);
  const pkg = lastProof[circuitKey];
  if (!pkg) {
    log.print("✗ No proof found — generate a proof first.", "err");
    return;
  }
  disable(snBtnId, true);
  const shown = new Set<string>();
  const progress = (raw: string) => {
    const mapped = friendlyProgress(raw);
    if (!mapped) return;
    if (shown.has(mapped.msg)) return;
    shown.add(mapped.msg);
    log.print(mapped.msg, mapped.cls);
  };
  try {
    const result = await submitFn(pkg, progress);
    log.print("", "div"); // spacer
    log.print(`✓ Proof accepted on-chain`, "ok");
    const short = result.txHash.slice(0, 10) + "…" + result.txHash.slice(-6);
    log.printLink(`  TX  ${short}`, result.explorerUrl);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.print(`✗ ${msg}`, "err");
  } finally {
    disable(snBtnId, false);
  }
}

// ─────────────────────────────────────────────
// Async init — load modules AFTER UI is rendered
// ─────────────────────────────────────────────

async function init() {
  try {
    // ── Step 1: init Noir WASM ──────────────────────────────────────────────
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

    // ── Step 2: init Garaga WASM ────────────────────────────────────────────
    setStatus("⏳ Initialising Garaga WASM...", "");
    const { initGaraga, submitToStarknet } = await import("./prover");
    await initGaraga();

    // ── Step 3: load proof flow modules ────────────────────────────────────
    const { generateBalanceProof, generateMultiAddressProof, generateHistoricalProof } =
      await import("./index");

    setStatus("✓ Ready — all WASM modules loaded", "ready");

    // Unlock prove buttons (submit buttons stay disabled until proof exists)
    ["b-btn", "ma-btn", "h-btn"].forEach(id => disable(id, false));
    ["b-log", "ma-log", "h-log"].forEach(id => {
      logger(id).clear();
    });

    // ── Wallet connect handler ───────────────────────────────────────────────

    function getInjectedWallet() {
      const win = window as any;
      // Ready wallet injects as starknet_argentX (confirmed via window inspection)
      return win['starknet_argentX'] ?? win['starknet_braavos'] ?? win.starknet ?? null;
    }

    async function connectWallet() {
      const walletBtn = document.getElementById("wallet-btn") as HTMLButtonElement;
      const walletStatus = document.getElementById("wallet-status")!;
      const hdrBtn = document.getElementById("hdr-wbtn") as HTMLButtonElement;
      const hdrAddr = document.getElementById("hdr-waddr")!;
      const injected = getInjectedWallet();

      if (!injected) {
        walletStatus.textContent = "✗ No wallet detected. Install Ready Wallet (formerly Argent X).";
        walletStatus.style.color = "#f44336";
        return;
      }

      try {
        walletBtn.disabled = true;
        walletBtn.textContent = "Connecting...";
        hdrBtn.textContent = "Connecting...";
        const accounts: string[] = await injected.request({
          type: "wallet_requestAccounts",
          params: { silent_mode: false },
        });
        const addr = accounts?.[0] ?? "";
        if (!addr) throw new Error("No accounts returned by wallet.");
        const short = addr.slice(0, 6) + "..." + addr.slice(-4);
        // panel status
        walletStatus.textContent = `✓ Connected: ${short} (Sepolia)`;
        walletStatus.className = "wallet-connected";
        walletBtn.textContent = "Connected";
        walletBtn.style.background = "#4caf50";
        walletBtn.disabled = false;
        // header button
        hdrBtn.textContent = "Connected";
        hdrBtn.classList.add("on");
        hdrAddr.textContent = short;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        walletStatus.textContent = `✗ ${msg}`;
        walletStatus.style.color = "#f44336";
        walletBtn.disabled = false;
        walletBtn.textContent = "Connect Wallet";
        hdrBtn.textContent = "Connect Wallet";
        hdrBtn.disabled = false;
      }
    }

    document.getElementById("wallet-btn")!.addEventListener("click", connectWallet);
    document.getElementById("hdr-wbtn")!.addEventListener("click", connectWallet);

    // Auto-show if wallet already connected
    const _injected = getInjectedWallet();
    if (_injected?.isConnected || _injected?.selectedAddress) {
      const addr = _injected.selectedAddress ?? _injected.account?.address ?? "";
      if (addr) {
        const short = addr.slice(0, 6) + "..." + addr.slice(-4);
        const walletStatus = document.getElementById("wallet-status")!;
        const walletBtn = document.getElementById("wallet-btn") as HTMLButtonElement;
        walletStatus.textContent = `✓ Connected: ${short} (Sepolia)`;
        walletStatus.className = "wallet-connected";
        walletBtn.textContent = "Connected";
        walletBtn.style.background = "#4caf50";
        const hdrBtn = document.getElementById("hdr-wbtn") as HTMLButtonElement;
        hdrBtn.textContent = "Connected";
        hdrBtn.classList.add("on");
        document.getElementById("hdr-waddr")!.textContent = short;
      }
    }

    // ── Prove handlers ────────────────────────────────────────────────────

    document.getElementById("b-btn")!.addEventListener("click", () => {
      const address   = (document.getElementById("b-address") as HTMLInputElement).value.trim();
      const btcVal    = parseFloat((document.getElementById("b-threshold") as HTMLInputElement).value.trim());
      if (!address) { logger("b-log").print("✗ Bitcoin address is required.", "err"); return; }
      if (isNaN(btcVal) || btcVal <= 0) { logger("b-log").print("✗ Threshold must be a positive BTC value (e.g. 0.1).", "err"); return; }
      const threshold = Math.round(btcVal * 1e8);
      runProof("b-btn", "b-sn-btn", "b-log", "balance",
        (progress) => generateBalanceProof(address, threshold, progress));
    });

    document.getElementById("ma-btn")!.addEventListener("click", () => {
      const a1 = (document.getElementById("ma-addr1") as HTMLInputElement).value.trim();
      const a2 = (document.getElementById("ma-addr2") as HTMLInputElement).value.trim();
      const addresses = [a1, a2].filter(Boolean);
      if (!a1) { logger("ma-log").print("✗ At least one Bitcoin address is required.", "err"); return; }
      const btcVal = parseFloat((document.getElementById("ma-threshold") as HTMLInputElement).value.trim());
      if (isNaN(btcVal) || btcVal <= 0) { logger("ma-log").print("✗ Threshold must be a positive BTC value (e.g. 0.5).", "err"); return; }
      const threshold = Math.round(btcVal * 1e8);
      runProof("ma-btn", "ma-sn-btn", "ma-log", "multi_address",
        (progress) => generateMultiAddressProof(addresses, threshold, progress));
    });

    document.getElementById("h-btn")!.addEventListener("click", () => {
      const address     = (document.getElementById("h-address") as HTMLInputElement).value.trim();
      const btcVal      = parseFloat((document.getElementById("h-threshold") as HTMLInputElement).value.trim());
      const sinceHeight = parseInt((document.getElementById("h-height") as HTMLInputElement).value.trim(), 10);
      if (!address) { logger("h-log").print("✗ Bitcoin address is required.", "err"); return; }
      if (isNaN(btcVal) || btcVal <= 0) { logger("h-log").print("✗ Threshold must be a positive BTC value (e.g. 0.1).", "err"); return; }
      if (isNaN(sinceHeight) || sinceHeight <= 0) { logger("h-log").print("✗ Block height must be a valid number (e.g. 840000).", "err"); return; }
      const threshold = Math.round(btcVal * 1e8);
      runProof("h-btn", "h-sn-btn", "h-log", "historical",
        (progress) => generateHistoricalProof(address, threshold, sinceHeight, progress));
    });

    // ── Submit to Starknet handlers ───────────────────────────────────────

    document.getElementById("b-sn-btn")!.addEventListener("click", () => {
      runSubmit("b-sn-btn", "b-log", "balance", submitToStarknet);
    });

    document.getElementById("ma-sn-btn")!.addEventListener("click", () => {
      runSubmit("ma-sn-btn", "ma-log", "multi_address", submitToStarknet);
    });

    document.getElementById("h-sn-btn")!.addEventListener("click", () => {
      runSubmit("h-sn-btn", "h-log", "historical", submitToStarknet);
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(`✗ Init failed: ${msg}`, "error");
    console.error("Init error:", e);
  }
}

init();
