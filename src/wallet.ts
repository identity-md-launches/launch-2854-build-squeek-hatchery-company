// Wallet connection and the optional Sepolia mint. Nothing here is needed to incubate, name, save or download.
import {
  connect, createConfig, disconnect, getBytecode, getConnection, getConnectors, http, injected, readContract,
  reconnect, simulateContract, switchChain, waitForTransactionReceipt, watchConnection, watchConnectors, writeContract,
  type Config, type Connector,
} from "@wagmi/core";
import { coinbaseWallet } from "@wagmi/connectors";
import { sepolia } from "viem/chains";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, decodeEventLog, isAddress, keccak256, toBytes, type Address, type Hash } from "viem";

export const SEPOLIA_ID = 11155111;
export const SITE_NAME = "Squeek Hatchery";

export interface RuntimeConfig { chainId: number; contractAddress: Address | null; rpcUrl: string; explorer: string }
const DEFAULTS: RuntimeConfig = { chainId: SEPOLIA_ID, contractAddress: null, rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" };

export const HATCHERY_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }, { name: "svg", type: "string" }, { name: "traits", type: "string" }, { name: "sessionId", type: "bytes32" }], outputs: [{ name: "id", type: "uint256" }] },
  { type: "function", name: "tokenOfSession", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  { type: "event", name: "Hatched", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "sessionId", type: "bytes32", indexed: true }, { name: "name", type: "string", indexed: false }] },
  { type: "error", name: "AlreadyMinted", inputs: [{ name: "sessionId", type: "bytes32" }, { name: "tokenId", type: "uint256" }] },
  { type: "error", name: "InvalidName", inputs: [] },
  { type: "error", name: "InvalidSvg", inputs: [] },
  { type: "error", name: "InvalidTraits", inputs: [] },
  { type: "error", name: "EmptySession", inputs: [] },
] as const;

export let runtime: RuntimeConfig = DEFAULTS;
export let config: Config;

/** Owner-settable: hatchery.config.json next to index.html holds the deployed address. No rebuild needed. */
export async function initWallet(): Promise<RuntimeConfig> {
  try {
    const r = await fetch("./hatchery.config.json", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      const addr = typeof j.contractAddress === "string" && isAddress(j.contractAddress) && !/^0x0{40}$/i.test(j.contractAddress) ? (j.contractAddress as Address) : null;
      runtime = {
        chainId: SEPOLIA_ID, // the site only ever targets Sepolia
        contractAddress: addr,
        rpcUrl: typeof j.rpcUrl === "string" && /^https?:\/\//.test(j.rpcUrl) ? j.rpcUrl : DEFAULTS.rpcUrl,
        explorer: typeof j.explorer === "string" && /^https:\/\//.test(j.explorer) ? j.explorer.replace(/\/$/, "") : DEFAULTS.explorer,
      };
    }
  } catch { /* keep defaults: minting stays unavailable without an address */ }
  config = createConfig({
    chains: [sepolia],
    multiInjectedProviderDiscovery: true, // EIP-6963: each installed extension by its own name
    connectors: [injected(), coinbaseWallet({ appName: SITE_NAME })],
    transports: { [sepolia.id]: http(runtime.rpcUrl) },
  });
  reconnect(config).catch(() => {});
  return runtime;
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const connection = () => getConnection(config);
export const onConnection = (fn: () => void) => watchConnection(config, { onChange: fn });
export const onConnectors = (fn: () => void) => watchConnectors(config, { onChange: fn });

/** Rows for the connect sheet, in the network's order. The generic injected row only when nothing was discovered. */
export function walletRows(): { connector: Connector; label: string }[] {
  const all = getConnectors(config);
  const named = all.some((c) => c.type === "injected" && c.id !== "injected");
  return [...all.filter((c) => c.type === "injected"), ...all.filter((c) => c.type !== "injected")]
    .filter((c) => !(c.id === "injected" && named))
    .map((c) => ({ connector: c, label: c.id === "injected" ? "Browser wallet" : c.id === "coinbaseWalletSDK" && isMobileBrowser() ? "Coinbase Smart Wallet" : c.name }));
}

export const connectWith = (connector: Connector) => connect(config, { connector, chainId: SEPOLIA_ID });
export const disconnectWallet = () => disconnect(config);
export const switchToSepolia = () => switchChain(config, { chainId: SEPOLIA_ID });

export const OPEN_IN: ReadonlyArray<{ id: string; name: string; href: (url: string) => string }> = [
  { id: "metamask", name: "MetaMask", href: (url) => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}` },
  { id: "coinbase", name: "Coinbase Wallet", href: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
  { id: "rabby", name: "Rabby", href: (url) => `https://go.rabby.io/mobile/dapp?url=${encodeURIComponent(url)}` },
  { id: "phantom", name: "Phantom", href: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}` },
];
export const isMobileBrowser = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as unknown as { ethereum?: unknown }).ethereum;

export const sessionKey = (id: string) => keccak256(toBytes(id));
export const txUrl = (h: string) => `${runtime.explorer}/tx/${h}`;
export const tokenUrl = (id: string) => `${runtime.explorer}/nft/${runtime.contractAddress}/${id}`;

export type MintEvent =
  | { kind: "checking" } | { kind: "confirm" } | { kind: "pending"; hash: Hash }
  | { kind: "success"; hash: Hash; tokenId: string } | { kind: "duplicate"; tokenId: string }
  | { kind: "rejected" } | { kind: "failed"; message: string; hash?: Hash };

/** Mint one hatched companion. Reports every state; never throws. */
export async function mintCompanion(args: { name: string; svg: string; traits: string; sessionId: string }, on: (e: MintEvent) => void) {
  const address = runtime.contractAddress;
  if (!address) return on({ kind: "failed", message: "Minting is unavailable: no Sepolia contract address is configured." });
  const conn = getConnection(config);
  if (!conn.address) return on({ kind: "failed", message: "Connect a wallet first." });
  if (conn.chainId !== SEPOLIA_ID) return on({ kind: "failed", message: "Switch your wallet to Sepolia first." });
  const sid = sessionKey(args.sessionId);
  let hash: Hash | undefined;
  try {
    on({ kind: "checking" });
    const code = await getBytecode(config, { address, chainId: SEPOLIA_ID });
    if (!code || code === "0x") return on({ kind: "failed", message: "No Squeek Hatchery contract was found at the configured Sepolia address." });
    const existing = await readContract(config, { address, abi: HATCHERY_ABI, functionName: "tokenOfSession", args: [sid], chainId: SEPOLIA_ID });
    if (existing > 0n) return on({ kind: "duplicate", tokenId: existing.toString() });
    const { request } = await simulateContract(config, { address, abi: HATCHERY_ABI, functionName: "mint", args: [args.name, args.svg, args.traits, sid], account: conn.address, chainId: SEPOLIA_ID });
    on({ kind: "confirm" });
    hash = await writeContract(config, request);
    on({ kind: "pending", hash });
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: SEPOLIA_ID });
    if (receipt.status !== "success") return on({ kind: "failed", message: "The transaction was mined but reverted. No NFT was created.", hash });
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: HATCHERY_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "Hatched") return on({ kind: "success", hash, tokenId: ev.args.tokenId.toString() });
      } catch { /* other logs */ }
    }
    on({ kind: "failed", message: "Mined, but the token ID could not be read from the receipt.", hash });
  } catch (e) {
    if (e instanceof BaseError) {
      if (e.walk((x) => x instanceof UserRejectedRequestError)) return on({ kind: "rejected" });
      const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
      if (revert?.data?.errorName === "AlreadyMinted") return on({ kind: "duplicate", tokenId: String(revert.data.args?.[1] ?? "") });
      if (revert?.data?.errorName) return on({ kind: "failed", message: `The contract refused the mint (${revert.data.errorName}).`, hash });
      if ((e as { code?: number }).code === 4001 || /reject|denied/i.test(e.message)) return on({ kind: "rejected" });
      return on({ kind: "failed", message: e.shortMessage || "The mint did not complete.", hash });
    }
    on({ kind: "failed", message: e instanceof Error ? e.message : "The mint did not complete.", hash });
  }
}
