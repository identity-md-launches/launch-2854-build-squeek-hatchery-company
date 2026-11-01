// Starts a throwaway local anvil chain (chain id 11155111 to mimic Sepolia) and deploys the compiled contract
// from an unlocked anvil dev account. No keys are used or stored.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";

export async function startChain(port = 8547) {
  const proc = spawn("anvil", ["--port", String(port), "--chain-id", "11155111", "--silent"], { stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  const chain = { ...sepolia, rpcUrls: { default: { http: [url] } } };
  const pub = createPublicClient({ chain, transport: http(url) });
  for (let i = 0; i < 50; i++) { try { await pub.getChainId(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const accounts = (await pub.request({ method: "eth_accounts" } as never)) as Address[];
  const wallet = (account: Address) => createWalletClient({ chain, transport: http(url), account });
  const artifact = JSON.parse(readFileSync("out/SqueekHatchery.sol/SqueekHatchery.json", "utf8"));
  const hash = await wallet(accounts[0]).deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, account: accounts[0], chain });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { url, pub, wallet, accounts, address: receipt.contractAddress as Address, abi: artifact.abi, stop: () => proc.kill() };
}
