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

/* DATA INJECTION HELPERS BELOW */

// Function that updates the virtual node rpc url in storage.
export function updateVirtualNodeRpcUrl(virtualNodeRpcUrl: string) {
  chrome.runtime.sendMessage({
    type: 'ORBY_UPDATE_VIRTUAL_NODE_RPC_URL',
    data: { virtualNodeRpcUrl: virtualNodeRpcUrl },
  });
}

// Function that updates the status of a connected app i.e. whether the wallet is still connected to the app or not.
export function updateConnectedAppStatus(
  appDomain: string,
  isConnected: boolean,
) {
  try {
    chrome.runtime.sendMessage({
      type: 'ORBY_UPDATE_APP_CONNECTION_STATUS',
      data: {
        appDomain: new URL(appDomain).hostname,
        isConnected: isConnected,
      },
    });
  } catch {
    chrome.runtime.sendMessage({
      type: 'ORBY_UPDATE_APP_CONNECTION_STATUS',
      data: { appDomain: appDomain, isConnected: isConnected },
    });
  }
}

// Function that initializes listeners for enabling unified balances on dapps.
export async function useUnifiedBalancesOnApps(
  reloadOnAppConnectedStatusChange: boolean,
  dataInjectorPath: string,
  getCurrentConfigs?: (response?: any) => void,
) {
  const reloadEnabled = reloadOnAppConnectedStatusChange;
  const dataInjectorScriptPath = dataInjectorPath;
  const data = await chrome.storage.local.get([
    'orbyVirtualNodeRpcUrl',
    'orbyConnectedApps',
  ]);

  let virtualNodeRpcUrl: string = data.orbyVirtualNodeRpcUrl || '';
  const connectedApps: Map<string, boolean> = new Map(
    Object.entries(data.orbyConnectedApps || {}),
  );
  const orbySupportedChains: Map<string, boolean> = new Map();
  const dataInjectionRules: Map<string, any> = new Map();
  getCurrentConfigs?.({
    virtualNodeRpcUrl,
    orbySupportedChains,
    connectedApps,
    dataInjectionRules,
  });

  if (virtualNodeRpcUrl) {
    getOrbySupportedChains(virtualNodeRpcUrl, orbySupportedChains);
    connectedApps.forEach((_value, key) => {
      getDataInjectionRulesForApp(virtualNodeRpcUrl, key, dataInjectionRules);
    });
  }

  // Add listener for receiving requests
  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message.type && message.type === 'ORBY_DATA_INJECTION_REQUEST') {
        await handleOrbyDataInjectionRequest(
          virtualNodeRpcUrl,
          message,
          connectedApps,
          dataInjectionRules,
          orbySupportedChains,
          sendResponse,
        );
      } else if (message.type === 'ORBY_UPDATE_VIRTUAL_NODE_RPC_URL') {
        const noVirtualNodeRpcUrl = virtualNodeRpcUrl ? false : true;
        virtualNodeRpcUrl = message.data.virtualNodeRpcUrl;
        chrome.storage.local.set({ orbyVirtualNodeRpcUrl: virtualNodeRpcUrl });
        if (noVirtualNodeRpcUrl) {
          await getOrbySupportedChains(virtualNodeRpcUrl, orbySupportedChains);
          connectedApps.forEach((_value, key) => {
            getDataInjectionRulesForApp(
              virtualNodeRpcUrl,
              key,
              dataInjectionRules,
            );
          });
        }
      } else if (message.type === 'ORBY_UPDATE_APP_CONNECTION_STATUS') {
        await handleConnectedAppStatusUpdate(
          virtualNodeRpcUrl,
          message.data.appDomain,
          message.data.isConnected,
          connectedApps,
          dataInjectionRules,
        );
        chrome.storage.local.set({
          orbyConnectedApps: Object.fromEntries(connectedApps),
        });
        reloadTabsRelatedToDomain(reloadEnabled, message.data.appDomain);
        sendResponse({ success: true });
      }
      return true;
    },
  );

  // Add listener for adding data injection script to connected apps
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      const appDomain = new URL(tab.url).hostname;
      if (connectedApps.get(appDomain)) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: addDataInjectionScriptToApp,
          args: [
            {
              dataInjectionScript: dataInjectorScriptPath,
              dataInjectionRuleForApp: dataInjectionRules.get(appDomain),
            },
          ],
        });
      } else {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: addReloadScriptToApp,
        });
      }
    }
  });
}

// Function that allows us to reload all connected tabs
async function reloadTabsRelatedToDomain(reload: boolean, appDomain: string) {
  if (reload) {
    chrome.tabs.query({ url: `*://*.${appDomain}/*` }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: 'ORBY_RELOAD_PAGE' });
      });
    });
  }
}

// Function that handles orby data injection requests.
async function handleOrbyDataInjectionRequest(
  rpcUrl: string,
  message: any,
  connectedAppsMap: any,
  dataInjectionRulesMap: any,
  orbySupportedChains: any,
  sendResponse: (response?: any) => void,
) {
  if (connectedAppsMap.get(message.appDomain) ? true : false) {
    if (message.action && message.action === 'getDataInjectionRuleForApp') {
      const response = await getDataInjectionRulesForApp(
        rpcUrl,
        message.appDomain,
        dataInjectionRulesMap,
      );
      sendResponse(response);
    } else if (
      message.action &&
      message.action === 'processDataInjectionRequest'
    ) {
      const response = await processDataInjectionRequest(
        rpcUrl,
        message,
        orbySupportedChains,
      );
      sendResponse(response);
    }
  }
}

// Function that handles connected app status updates.
async function handleConnectedAppStatusUpdate(
  rpcUrl: string,
  appDomain: string,
  isConnected: boolean,
  connectedAppsMap: any,
  dataInjectionRulesMap: any,
) {
  if (isConnected) {
    connectedAppsMap.set(appDomain, isConnected);
    await getDataInjectionRulesForApp(rpcUrl, appDomain, dataInjectionRulesMap);
  } else {
    connectedAppsMap.delete(appDomain);
    dataInjectionRulesMap.delete(appDomain);
  }
}

// Function that fetches the data injection rules for an app domain from orby.
async function getOrbySupportedChains(
  rpcUrl: string,
  orbySupportedChains: Map<string, boolean>,
): Promise<any> {
  try {
    const response = await orbyCall(
      rpcUrl,
      'orby_getChainsSupportedByDefault',
      [],
    );
    const data = await response.json();
    data.result.blockchains.forEach((supportedChain) => {
      const splitLayer = supportedChain.chainId.split('-');
      const chainIdNumber = splitLayer[splitLayer.length - 1];
      orbySupportedChains.set(chainIdNumber, true);
    });
  } catch (error) {
    console.log('get orby supported chains', error);
  }
}

// Function that fetches the data injection rules for an app domain from orby.
async function getDataInjectionRulesForApp(
  rpcUrl: string,
  appDomain: any,
  dataInjectionRules: any,
): Promise<any> {
  try {
    if (!dataInjectionRules.has(appDomain)) {
      const response = await orbyCall(rpcUrl, 'orby_getDataInjectionRule', []);
      const data = await response.json();
      dataInjectionRules.set(appDomain, data.result);
    }
  } catch (error) {
    console.log('get data injection rules for app', error);
  }

  return dataInjectionRules.get(appDomain);
}

// Function that sends data injection requests to orby for processing.
async function processDataInjectionRequest(
  rpcUrl: string,
  message: any,
  orbySupportedChains: any,
): Promise<{ success: boolean; response?: any }> {
  try {
    const hasSupportedChains = Array.from(orbySupportedChains).length > 0;
    const formattedRpcChainId = BigInt(message.rpcChainId).toString();
    const isSupportedChain = orbySupportedChains.get(formattedRpcChainId)
      ? true
      : false;
    if (hasSupportedChains && !isSupportedChain) {
      return { success: false };
    }

    // Ping orby otherwise.
    const orbyResponse = await orbyCall(
      rpcUrl,
      'orby_processDataInjectionRequest',
      [
        {
          requestUrl: message.request[0],
          requestBody: message.request[1],
          isJsonRpcCall: message.isJsonRpcCall,
          rpcChainId: formattedRpcChainId,
        },
      ],
    );

    // Return the results
    const orbyData = await orbyResponse.json();
    return {
      success: orbyData.result ? orbyData.result.success : false,
      response: {
        headers: [...orbyResponse.headers.entries()],
        status: orbyResponse.status,
        statusText: orbyResponse.statusText,
        body: orbyData.result ? orbyData.result.response : '',
      },
    };
  } catch (error) {
    return { success: false };
  }
}

// Function to inject a script into the webpage context
function addDataInjectionScriptToApp(params: {
  dataInjectionScript: string;
  dataInjectionRuleForApp: any;
}) {
  if (!window.__fetchOverwritten) {
    window.__fetchOverwritten = true;

    // add data injection scripts to the app
    document.body.setAttribute(
      'orby-data-injection-rule-for-app',
      params.dataInjectionRuleForApp,
    );
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(params.dataInjectionScript);
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

    // Add listeners that receive requests from the app
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (
        event.data.id &&
        event.data.type &&
        event.data.type === 'ORBY_DATA_INJECTION_REQUEST'
      ) {
        const response = await sendDataInjectionRequestToServiceWorker(
          event.data,
        );
        window.postMessage(
          { type: 'ORBY_DATA_INJECTION_RESPONSE', id: event.data.id, response },
          window.location.origin,
        );
      }
    });

    // Add a listener that reloads the page if the app disconnects.
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ORBY_RELOAD_PAGE') {
        window.location.reload();
      }
    });

    // Function that fetches the data injection rules from the background service worker
    async function sendDataInjectionRequestToServiceWorker(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  }
}

// Function to add reload script into the webpage context
function addReloadScriptToApp() {
  if (!window.__reloadAdded) {
    window.__reloadAdded = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ORBY_RELOAD_PAGE') {
        window.location.reload();
      }
    });
  }
}

// Function that makes calls to orby using fetch.
function orbyCall(rpcUrl: string, method: string, params: any) {
  return fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: Math.floor(Math.random() * 1000) + 1,
      jsonrpc: '2.0',
      method,
      params: params,
    }),
  });
}
