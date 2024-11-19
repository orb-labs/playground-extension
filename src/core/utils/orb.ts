import { providers } from 'ethers';
import { useEffect, useState } from 'react';
import { Address, formatUnits } from 'viem';

import { keychainManager } from '~/core/keychain/KeychainManager';
import { ParsedUserAsset } from '~/core/types/assets';
import { ChainId, ChainName } from '~/core/types/chains';
import { add } from '~/core/utils/numbers';

const PUBLIC_ORB_RPC_BASE = 'https://api-rpc-dev.orblabs.xyz';
const PUBLIC_ORB_API_KEY = '4ff141e9-98c5-43ee-8b0e-d552f831b68e';
const PRIVATE_ORB_API_KEY = 'f1c1d996-8df4-4d23-b926-ca702173021d';

const GLOBAL = {};

export const convertFungibleTokenToParsedUserAsset = (
  fungibleToken: any,
): ParsedUserAsset => {
  console.log('fungibleToken', fungibleToken);
  return {
    decimals: fungibleToken.total.currency.decimals,
    uniqueId: fungibleToken.standardizedTokenId,
    isNativeAsset:
      fungibleToken.tokenBalancesOnChains[0].token.currency.isNative,
    name: fungibleToken.total.currency.asset.name,
    symbol: fungibleToken.total.currency.asset.symbol,
    // NOTE: we use the address from the fungible token here to be able to select the token
    // It doesn't seem to break anything yet, but we'll need to change this if it does
    address: fungibleToken.standardizedTokenId as Address,
    chainId: ChainId.arbitrum,
    chainName: ChainName.arbitrum,
    balance: {
      amount: formatUnits(
        fungibleToken.total.amount,
        fungibleToken.total.currency.decimals,
      ),
      display: `${formatUnits(
        fungibleToken.total.amount,
        fungibleToken.total.currency.decimals,
      )} ${fungibleToken.total.currency.asset.symbol}`,
    },
    native: {
      balance: {
        amount: '',
        display: '', // this is the price
      },
      price: {
        change: '',
        amount: fungibleToken.total.value,
        display: 'foo',
      },
    },
    icon_url: fungibleToken.total.currency.logoUrl,
  };
};

export const convertFungibleTokensToParsedUserAssets = (
  fungibleTokens: any,
): ParsedUserAsset[] => {
  return fungibleTokens.map((fungibleToken) => {
    return convertFungibleTokenToParsedUserAsset(fungibleToken);
  });
};

export const getAggregateFeeDisplayFromOperationSet = (operationSet: any) => {
  console.log('operationSet in the helper function', operationSet);
  return operationSet &&
    operationSet.aggregateOperationFeeInFiatCurrency &&
    operationSet.aggregateNetworkFeeInFiatCurrency
    ? Number(
        add(
          formatUnits(
            operationSet.aggregateOperationFeeInFiatCurrency.amount,
            operationSet.aggregateOperationFeeInFiatCurrency.currency.decimals,
          ),
          formatUnits(
            operationSet.aggregateNetworkFeeInFiatCurrency.amount,
            operationSet.aggregateNetworkFeeInFiatCurrency.currency.decimals,
          ),
        ),
      ).toFixed(4)
    : '~';
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

export const useVirtualNodeRpcUrl = (
  clusterId,
  currentAddress,
  testnetMode,
) => {
  const [virtualNodeRpcUrl, setVirtualNodeRpcUrl] = useState<string | null>(
    null,
  );

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
                chainId: testnetMode ? `EIP155-11155420` : `EIP155-8453`,
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

export const getOperationsToExecuteTransaction = async ({
  virtualNodeRpcUrl,
  request,
}: {
  virtualNodeRpcUrl: string;
  request: {
    to: string;
    data: string;
    value: string;
    accountClusterId: string;
  };
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'orby_getOperationsToExecuteTransaction',
      params: [{ ...request }],
    }),
  });

  const { result } = await response.json();
  console.log('getOperationsToExecuteTransaction result', result);
  return result;
};

export const getOperationsToSignTypedData = async ({
  clusterId,
  virtualNodeRpcUrl,
  to,
  data,
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 2,
      jsonrpc: '2.0',
      method: 'orby_getOperationsToSignTypedData',
      params: [{ to, data, accountClusterId: clusterId }],
    }),
  });

  const { result } = await response.json();
  console.log('getOperationsToSignTypedData result', result);
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
  const { result } = await response.json();
  console.log('sendSignedOperations result', result);
  return result;
};

// Function that signs an operation set.
export async function signOperationSet(operations) {
  const signedOperations = [];

  // Loop through and sign all the operations
  for (let i = 0; i < operations.length; i++) {
    console.log('operations[i]', operations[i]);
    // Set the provider and wallet instances for each operation
    const provider = new providers.JsonRpcProvider(operations[i].txRpcUrl);
    const signer = await keychainManager.getSigner(
      operations[i].from as Address,
    );
    const wallet = signer.connect(provider);

    console.log('provider', provider);
    console.log('signer', signer);
    console.log('wallet', wallet);

    let signedOperation;

    // Sign transactions or typed data
    if (operations[i].format == 'TRANSACTION') {
      const txData = {
        from: operations[i].from,
        to: operations[i].to,
        value: operations[i].value,
        data: operations[i].data,
        nonce: operations[i].nonce,
        gasLimit: operations[i].gasLimit,
        // TODO: make note of this, add this to Monday, remind Felix of this
        // gasPrice: operations[i].gasPrice,
        maxFeePerGas: operations[i].maxFeePerGas,
        maxPriorityFeePerGas: operations[i].maxPriorityFeePerGas,
      };

      console.log('txData', txData);

      const tx = await wallet.populateTransaction(txData);
      console.log('tx', tx);
      const signedTx = await wallet.signTransaction(tx);
      console.log('signedTx', signedTx);
      signedOperation = { type: operations[i].type, signature: signedTx };
    } else if (operations[i].format == 'TYPED_DATA') {
      const parsedData = JSON.parse(operations[i].data);

      const signature = await wallet.signTypedData(
        parsedData.domain,
        parsedData.types,
        parsedData.message,
      );

      console.log('signature', signature);

      signedOperation = {
        type: operations[i].type,
        signature,
        data: operations[i].data,
      };
    }
    // append transaction to the signed operations array
    signedOperations.push(signedOperation);
  }
  console.log('signedOperations: ', signedOperations);
  // Return the signed operations array
  return signedOperations;
}

export const usePortfolio = (clusterId, virtualNodeRpcUrl) => {
  const [portfolio, setPortfolio] = useState(GLOBAL.PORTFOLIO || null);
  const [loading, setLoading] = useState(GLOBAL.PORTFOLIO ? false : true);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(!GLOBAL.PORTFOLIO);
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

      // sort first by balance descending, then by symbol
      result.fungibleTokenBalances.sort((a, b) => {
        if (Number(b.total.amount) > Number(a.total.amount)) return 1;
        if (Number(b.total.amount) < Number(a.total.amount)) return -1;

        return a.total.currency.asset.symbol.localeCompare(
          b.total.currency.asset.symbol,
        );
      });

      console.log('portfolio data', result);

      GLOBAL.PORTFOLIO = result;
      setPortfolio(result);
      setLoading(false);
    };
    if (clusterId && virtualNodeRpcUrl) {
      fetchPortfolio();
    }
  }, [clusterId, virtualNodeRpcUrl]);

  return { portfolio, loading };
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
      console.log(
        `${Number(result.totalValueInFiat.value).toFixed(
          result.totalValueInFiat.currency.decimals,
        )}`,
      );
      setPortfolioBalance(
        `$${Number(result.totalValueInFiat.value).toFixed(
          result.totalValueInFiat.currency.decimals,
        )}`,
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
  amount: string;
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
  const { result } = await response.json();
  console.log('operations to transfer token', result);
  return result;
};

export const getOperationsToSwap = async ({
  virtualNodeRpcUrl,
  clusterId,
  swapType,
  input,
  output,
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'orby_getOperationsToSwap',
      params: [
        {
          accountClusterId: clusterId,
          swapType,
          input,
          output,
        },
      ],
    }),
  });

  const { result } = await response.json();
  return result;
};

export const getStandardizedTokenId = async ({
  virtualNodeRpcUrl,
  chainId,
  tokenAddress,
}: {
  virtualNodeRpcUrl: string;
  chainId: string;
  tokenAddress: string;
}) => {
  const response = await fetch(virtualNodeRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'orby_getStandardizedTokenIds',
      params: [
        {
          tokens: [
            {
              chainId,
              tokenAddress,
            },
          ],
        },
      ],
    }),
  });
  const { result } = await response.json();
  console.log('result', result);

  // TODO: get the first one
  return result?.standardizedTokenIds?.[0] || null;
};
