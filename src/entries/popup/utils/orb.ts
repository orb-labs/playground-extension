import { useEffect, useState } from 'react';
import { Address } from 'viem';

import { ParsedUserAsset } from '~/core/types/assets';
import { ChainId, ChainName } from '~/core/types/chains';

const PUBLIC_ORB_RPC_BASE = 'https://api-rpc-dev.orblabs.xyz';
const PUBLIC_ORB_API_KEY = '';
const PRIVATE_ORB_API_KEY = '';

export const convertFungibleTokenToParsedUserAsset = (
  fungibleToken: any,
): ParsedUserAsset => {
  return {
    decimals: fungibleToken.total.currency.decimals,
    uniqueId: fungibleToken.standardizedTokenId,
    isNativeAsset: fungibleToken.total.currency.isNative,
    name: fungibleToken.total.currency.asset.name,
    symbol: fungibleToken.total.currency.asset.symbol,
    // NOTE: we use the address from the fungible token here to be able to select the token
    // It doesn't seem to break anything yet, but we'll need to change this if it does
    address: fungibleToken.standardizedTokenId as Address,
    chainId: ChainId.mainnet,
    chainName: ChainName.mainnet,
    balance: {
      amount: fungibleToken.total.amount,
      display: `${fungibleToken.total.amount} ${fungibleToken.total.currency.asset.symbol}`,
    },
    native: {
      balance: {
        amount: fungibleToken.total.amount,
        display: `$${fungibleToken.total.amount}`,
      },
      price: {
        change: '',
        amount: fungibleToken.total.value,
        display: 'foo',
      },
    },
  };
};

export const convertFungibleTokensToParsedUserAssets = (
  fungibleTokens: any,
): ParsedUserAsset[] => {
  return fungibleTokens.map((fungibleToken) => {
    return convertFungibleTokenToParsedUserAsset(fungibleToken);
  });
};

export const useCreateClusterId = (currentAddress) => {
  const [clusterId, setClusterId] = useState(null);

  useEffect(() => {
    const createClusterId = async (address) => {
      const accounts = [
        {
          address,
          vmType: 'EVM',
          accountType: 'EOA',
        },
      ];
      const response = await fetch(
        `${PUBLIC_ORB_RPC_BASE}/${PRIVATE_ORB_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'orby_createAccountCluster',
            params: [{ accounts }],
          }),
        },
      );
      const { result } = await response.json();
      console.log('cluster data', result);
      setClusterId(result.accountClusterId);
    };
    createClusterId(currentAddress);
  }, [currentAddress]);

  return clusterId;
};

export const useVirtualNodeRpcUrl = (clusterId, currentAddress) => {
  const [virtualNodeRpcUrl, setVirtualNodeRpcUrl] = useState(null);

  useEffect(() => {
    const fetchVirtualNodeRpcUrl = async () => {
      const response = await fetch(
        `${PUBLIC_ORB_RPC_BASE}/${PRIVATE_ORB_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 2,
            jsonrpc: '2.0',
            method: 'orby_getVirtualNodeRpcUrl',
            params: [
              {
                accountClusterId: clusterId,
                entrypointAccountAddress: currentAddress,
                chainId: 'EIP155-1',
              },
            ],
          }),
        },
      );
      const { result } = await response.json();
      console.log('virtual node rpc url', result);
      setVirtualNodeRpcUrl(result.virtualNodeRpcUrl);
    };
    if (clusterId && currentAddress) {
      fetchVirtualNodeRpcUrl();
    }
  }, [clusterId, currentAddress]);

  return virtualNodeRpcUrl;
};

export const usePortfolio = (clusterId, virtualNodeRpcUrl) => {
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      const response = await fetch(virtualNodeRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 2,
          jsonrpc: '2.0',
          method: 'orby_getFungibleTokenPortfolio',
          params: [{ accountClusterId: clusterId }],
        }),
      });
      const { result } = await response.json();
      console.log('portfolio data', result);
      setPortfolio(result);
    };
    if (clusterId && virtualNodeRpcUrl) {
      fetchPortfolio();
    }
  }, [clusterId, virtualNodeRpcUrl]);

  return portfolio;
};

export const usePortfolioBalance = (clusterId, virtualNodeRpcUrl) => {
  const [portfolioBalance, setPortfolioBalance] = useState(null);

  useEffect(() => {
    const fetchPortfolioBalance = async () => {
      const response = await fetch(virtualNodeRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 2,
          jsonrpc: '2.0',
          method: 'orby_getPortfolioOverview',
          params: [{ accountClusterId: clusterId }],
        }),
      });
      const { result } = await response.json();
      console.log('portfolio balance data', result);
      setPortfolioBalance(
        `$${Number(result.totalValueInFiat.value).toFixed(2)}`,
      );
    };
    if (clusterId && virtualNodeRpcUrl) {
      fetchPortfolioBalance();
    }
  }, [clusterId, virtualNodeRpcUrl]);

  return portfolioBalance;
};

export const getOperationsToTransferToken = async ({
  clusterId,
  standardizedTokenId,
  amount,
  recipient,
  virtualNodeRpcUrl,
}: {
  clusterId: string;
  standardizedTokenId: string;
  amount: number;
  recipient: { address: string; chainId: string };
  virtualNodeRpcUrl: string;
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 2,
      jsonrpc: '2.0',
      method: 'orby_getOperationsToTransferToken',
      params: [
        {
          accountClusterId: clusterId,
          standardizedTokenId,
          amount,
          recipient,
        },
      ],
    }),
  });
  const result = await response.json();
  console.log('operations to transfer token', result);
  return result;
};

export const sendSignedOperations = async ({
  clusterId,
  signedOperations,
  virtualNodeRpcUrl,
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 2,
      jsonrpc: '2.0',
      method: 'orby_sendSignedOperations',
      params: [{ accountClusterId: clusterId, signedOperations }],
    }),
  });
  const result = await response.json();
  console.log('sendSignedOperations result', result);
  return result;
};
