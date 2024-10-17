import { keychainManager } from '../keychain/KeychainManager';

// Function that signs an operation set.
export async function signOperationSet(operationSet, provider) {
  const signedOperations = [];

  // Extract the operations in the operationSet.
  const operations = operationSet.intents
    .flatMap((intent) => intent.intentOperations)
    .concat(operationSet.primaryTransaction);

  // track nonces to avoid signing multiple transactions with the same nonce.
  const nonceMap = new Map<string, number>();

  // Loop through and sign all the operations
  for (let i = 0; i < operations.length; i++) {
    // Set the provider and wallet instances for each operation

    // const txProvider = new ethers.JsonRpcProvider(operations[i].txRpcUrl);

    const signer = await keychainManager.getSigner(
      operations[i].from as Address,
    );
    const wallet = signer.connect(provider);

    let signedOperation;

    // Sign transactions or typed data
    if (operations[i].format == 'TRANSACTION') {
      const nonce = nonceMap.get(operations[i].chainId)
        ? nonceMap.get(operations[i].chainId) + BigInt(1)
        : await wallet.getNonce();
      nonceMap.set(operations[i].chainId, BigInt(nonce));

      const txData = {
        from: operations[i].from,
        to: operations[i].to,
        value: value ?? value?.toRawAmount(),
        data: operations[i].data,
        nonce: Number(nonce),
        gasLimit: operations[i].gasLimit,
        gasPrice: operations[i].gasPrice,
        maxFeePerGas: operations[i].maxFeePerGas,
        maxPriorityFeePerGas: operations[i].maxPriorityFeePerGas,
      };

      const tx = await wallet.populateTransaction(txData);
      const signedTx = await wallet.signTransaction(tx);
      signedOperation = { type: operations[i].type, signature: signedTx };
    } else if (operations[i].format == 'TYPED_DATA') {
      const parsedData = JSON.parse(operations[i].data);

      const signature = await wallet.signTypedData(
        parsedData.domain,
        parsedData.types,
        parsedData.message,
      );

      signedOperation = {
        type: operations[i].type,
        signature,
        data: operations[i].data,
      };
    }
    // append transaction to the signed operations array
    signedOperations.push(signedOperation);
  }
  // Return the signed operations array
  return signedOperations;
}
