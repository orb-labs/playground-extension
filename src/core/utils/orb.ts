import { TypedDataField } from '@ethersproject/abstract-signer';
import {
  FungibleTokenAmount,
  OnchainOperation,
  OperationDataFormat,
  StandardizedBalance,
  VMType,
  getVirtualEnvironment,
} from '@orb-labs/orby-core';
import {
  AddressLookupTableAccount,
  Connection,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { providers } from 'ethers';
import _ from 'lodash';
import { Address, TypedDataDomain, formatUnits } from 'viem';

import { ParsedUserAsset } from '~/core/types/assets';
import { ChainName } from '~/core/types/chains';
import { convertRawAmountToDecimalFormat } from '~/core/utils/numbers';

import { keychainManager } from '../keychain/KeychainManager';

export const convertStandardizedBalanceToParsedUserAsset = (
  balance: StandardizedBalance,
): ParsedUserAsset => {
  const relatedChainIds = balance.tokenBalancesOnChains.map((balance) =>
    balance.token.chainId.toString(),
  );

  const relatedAssets = convertTokenBalancesOnChainsToParsedUserAssets(
    balance.tokenBalancesOnChains,
    balance,
  );

  const tokenAmount = _.sample(balance.tokenBalancesOnChains);

  return {
    decimals: balance.total.currency.decimals,
    uniqueId: balance.standardizedTokenId,
    standardizedTokenId: balance.standardizedTokenId,
    isNativeAsset: balance.tokenBalancesOnChains[0].token.isNative,
    name: balance.total.currency.name,
    symbol: balance.total.currency.symbol,
    // NOTE: we use the address from the fungible token here to be able to select the token
    // It doesn't seem to break anything yet, but we'll need to change this if it does
    address: tokenAmount?.token.address as Address,
    chainId: Number(tokenAmount?.token.chainId),
    chainName: ChainName.mainnet,
    balance: {
      amount: formatUnits(
        balance.total.toRawAmount(),
        balance.total.currency.decimals,
      ),
      display: `${convertRawAmountToDecimalFormat(
        new BigNumber(balance.total.toRawAmount()?.toString()),
        balance.total.currency.decimals,
      )} ${balance.total.currency.symbol}`,
      displayOnchain: `${convertRawAmountToDecimalFormat(
        new BigNumber(balance.total.toRawAmount()?.toString()),
        balance.total.currency.decimals,
      )} ${balance.total.currency.symbol}`,
    },
    native: {
      balance: {
        amount: '',
        display: '', // this is the price
      },
      price: {
        change: '',
        amount: Number(balance.total.toRawAmount()),
        display: 'foo',
      },
    },
    icon_url: balance.total.currency.logoUrl,
    relatedChainIds,
    relatedAssets,
  };
};

export const convertStandardizedBalanceToParsedUserAssets = (
  balances: StandardizedBalance[],
): ParsedUserAsset[] => {
  return balances
    .map((balance) => convertStandardizedBalanceToParsedUserAsset(balance))
    ?.sort((a, b) => {
      if (a.isNativeAsset && b.isNativeAsset) {
        return 0;
      } else if (a.isNativeAsset) {
        return -1;
      }

      return 1;
    });
};

export const convertFungibleTokenAmountToParsedUserAsset = (
  balance: FungibleTokenAmount,
  standardizedBalance: StandardizedBalance,
): ParsedUserAsset => {
  return {
    decimals: balance.token.decimals,
    standardizedTokenId: standardizedBalance.standardizedTokenId,
    uniqueId: balance.token.identifier(),
    isNativeAsset: balance.token.isNative,
    name: balance.token.name,
    symbol: balance.token.symbol,
    // NOTE: we use the address from the fungible token here to be able to select the token
    // It doesn't seem to break anything yet, but we'll need to change this if it does
    address: balance.token.address as Address,
    chainId: Number(balance.token.chainId),
    chainName: ChainName.mainnet,
    balance: {
      amount: formatUnits(
        standardizedBalance.total.toRawAmount(),
        standardizedBalance.total.currency.decimals,
      ),
      display: `${convertRawAmountToDecimalFormat(
        new BigNumber(standardizedBalance.total.toRawAmount()?.toString()),
        standardizedBalance.total.currency.decimals,
      )} ${balance.token.symbol}`,
      displayOnchain: `${convertRawAmountToDecimalFormat(
        new BigNumber(balance.toRawAmount()?.toString()),
        balance.token.decimals,
      )} ${balance.token.symbol}`,
    },
    native: {
      balance: {
        amount: '',
        display: '', // this is the price
      },
      price: {
        change: '',
        amount: Number(standardizedBalance.total.toRawAmount()),
        display: 'foo',
      },
    },
    icon_url: standardizedBalance.total.currency.logoUrl,
  };
};

export const convertFungibleTokenAmountsToParsedUserAssets = (
  balances: StandardizedBalance[],
): ParsedUserAsset[] => {
  return balances
    .map((standardizedBalance) => {
      return convertTokenBalancesOnChainsToParsedUserAssets(
        standardizedBalance.tokenBalancesOnChains,
        standardizedBalance,
      );
    })
    .flat();
};

export const convertTokenBalancesOnChainsToParsedUserAssets = (
  tokenBalancesOnChains: FungibleTokenAmount[],
  standardizedBalance: StandardizedBalance,
): ParsedUserAsset[] => {
  return tokenBalancesOnChains.map((balance) =>
    convertFungibleTokenAmountToParsedUserAsset(balance, standardizedBalance),
  );
};

export const getWalletVirtualEnvironment = (
  address: string,
): VMType | undefined => {
  const startsWith0xLen42HexRegex = /^0x[0-9a-fA-F]{40}$/;
  const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (startsWith0xLen42HexRegex.test(address)) {
    return VMType.EVM;
  } else if (solanaRegex.test(address)) {
    return VMType.SVM;
  }

  return undefined;
};

export async function signSVMTransaction(
  txRpcUrl: string,
  data: string,
  from?: string,
): Promise<string> {
  const keypair = await keychainManager.getKeyPair(from as Address);
  const connection = new Connection(txRpcUrl);

  const originalTransaction = VersionedTransaction.deserialize(
    Buffer.from(data, 'hex'),
  );

  // Fetch the lookup tables from the blockchain
  const lookupTableAddresses =
    originalTransaction.message.addressTableLookups.map(
      (lookup) => lookup.accountKey,
    );
  const lookupTableAccounts =
    await connection.getMultipleAccountsInfo(lookupTableAddresses);

  // Create the necessary lookup table account objects
  const addressLookupTableAccounts = lookupTableAccounts.map((account, i) => {
    return new AddressLookupTableAccount({
      key: lookupTableAddresses[i],
      state: AddressLookupTableAccount.deserialize(account.data),
    });
  });

  const originalMessage = TransactionMessage.decompile(
    originalTransaction.message,
    { addressLookupTableAccounts },
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const versionedMergedTxMessage = new TransactionMessage({
    payerKey: originalMessage.payerKey,
    recentBlockhash: blockhash,
    instructions: originalMessage.instructions,
  }).compileToV0Message();

  const versionMergedTx = new VersionedTransaction(versionedMergedTxMessage);

  console.log(
    'originalMessage',
    originalTransaction,
    keypair,
    txRpcUrl,
    from,
    keypair.publicKey?.toString(),
  );

  originalMessage.instructions.forEach((instruction, idx) => {
    console.log(`Instruction ${idx + 1}:`);

    // Iterate through the keys in each instruction to check for 'isSigner: true'
    instruction.keys.forEach((key) => {
      if (key.isSigner) {
        console.log(`Account ${key.pubkey.toBase58()} is a signer`);
      } else {
        console.log(`Account ${key.pubkey.toBase58()} is NOT a signer`);
      }
    });
  });

  versionMergedTx.sign([
    {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
    },
  ]);

  return Buffer.from(versionMergedTx.serialize())?.toString('hex');
}

export async function signOperation(
  operation: OnchainOperation,
): Promise<string> {
  if (getVirtualEnvironment(operation.chainId) == VMType.SVM) {
    return signSVMTransaction(
      operation.txRpcUrl,
      operation.data,
      operation.from,
    );
  }

  const provider = new providers.JsonRpcProvider(operation.txRpcUrl);
  const signer = await keychainManager.getSigner(operation.from as Address);
  const wallet = signer.connect(provider);

  if (operation.format == OperationDataFormat.TRANSACTION) {
    const txData = {
      from: operation.from,
      to: operation.to,
      value: operation.value,
      data: operation.data,
      nonce: operation.nonce,
      gasLimit: operation.gasLimit,
      chainId: operation.chainId ? Number(operation.chainId) : undefined,
      // TODO: make note of this, add this to Monday, remind Felix of this
      // gasPrice: operations[i].gasPrice,
      maxFeePerGas: operation.maxFeePerGas,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
    };

    // eslint-disable-next-line no-await-in-loop
    const tx = await wallet.populateTransaction(txData);
    return await signer.signTransaction(tx);
  } else {
    const parsedData = JSON.parse(operation.data) as {
      domain: TypedDataDomain;
      types: Record<string, Array<TypedDataField>>;
      message: Record<string, any>;
    };

    delete parsedData.types['EIP712Domain'];
    // @ts-ignore
    const signature = await wallet.signTypedData(
      parsedData.domain,
      parsedData.types,
      parsedData.message,
    );

    return signature;
  }
}
