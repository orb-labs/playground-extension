import { providers } from 'ethers';
import { useEffect, useState } from 'react';
import { Address } from 'viem';

import { keychainManager } from '~/core/keychain/KeychainManager';

const PUBLIC_ORB_RPC_BASE = 'https://api-rpc-dev.orblabs.xyz';
const PUBLIC_ORB_API_KEY = '4ff141e9-98c5-43ee-8b0e-d552f831b68e';
const PRIVATE_ORB_API_KEY = 'f1c1d996-8df4-4d23-b926-ca702173021d';

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
