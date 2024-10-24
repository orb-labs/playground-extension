import { providers } from 'ethers';

import { keychainManager } from '../keychain/KeychainManager';

// Function that signs an operation set.
export async function signOperationSet(operationSet) {
  const signedOperations = [];

  console.log('operationSet', operationSet);

  // Extract the operations in the operationSet.
  const operations = operationSet.intents
    .map((intent) => intent.intentOperations)
    .flat()
    ?.concat(operationSet.primaryOperation)
    .filter((value) => value !== undefined && value !== null);

  console.log('operations', operations);

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
