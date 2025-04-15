import { Signer } from '@ethersproject/abstract-signer';
import { Mnemonic } from '@ethersproject/hdnode';
import { Wallet } from '@ethersproject/wallet';
import { Keypair } from '@solana/web3.js';
import { Address } from 'viem';

export type PrivateKey = string;

export type TWallet = Omit<Wallet, 'address' | 'privateKey'> & {
  address: Address;
  evmAddress: string;
  svmAddress: string;
  privateKey: PrivateKey;
  svmKey: Keypair;
};

export interface IKeychain {
  type: string;
  serialize(): Promise<unknown>;
  deserialize(options: unknown): Promise<void>;
  addNewAccount(): Promise<Array<Wallet>>;
  addAccountAtIndex(index: number, address: Address): Promise<Address>;
  getAccounts(): Promise<Array<Address>>;
  getSigner(address: Address): Signer;
  getKeyPair(_address: Address): Keypair;
  exportAccount(address: Address): Promise<PrivateKey>;
  exportKeychain(address: Address): Promise<Mnemonic['phrase']>;
  removeAccount(address: Address): Promise<void>;
}
