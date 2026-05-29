import { mnemonicToSeedSync } from "bip39";
import { HDNodeWallet } from "ethers";

const MNEMONIC = process.env.WALLET_MNEMONIC || "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const seed = mnemonicToSeedSync(MNEMONIC);

export function generateBscAddress(index: number): { address: string; privateKey: string } {
  const hdNode = HDNodeWallet.fromSeed(seed);
  const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
  return { address: child.address, privateKey: child.privateKey };
}
