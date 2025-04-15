import { registerWallet } from './register';
import { RainbowWallet } from './wallet';
import type { SolanaProvider } from './window';

export function initialize(solana: SolanaProvider): void {
  registerWallet(new RainbowWallet(solana));
}
