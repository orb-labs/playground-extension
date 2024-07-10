import { TransactionRequest } from '@ethersproject/abstract-provider';
import { useQuery } from '@tanstack/react-query';

import {
  QueryConfig,
  QueryFunctionArgs,
  QueryFunctionResult,
  createQueryKey,
  queryClient,
} from '~/core/react-query';
import { getChainGasUnits } from '~/core/references/chains';
import { ChainId } from '~/core/types/chains';
import { estimateGas } from '~/core/utils/gas';
import { getProvider } from '~/core/wagmi/clientToProvider';

// ///////////////////////////////////////////////
// Query Types

export type EstimateGasLimitResponse = {
  gasLimit: string;
};

export type EstimateGasLimitArgs = {
  chainId: ChainId;
  transactionRequest: TransactionRequest;
};

// ///////////////////////////////////////////////
// Query Key

const estimateGasLimitQueryKey = ({
  chainId,
  transactionRequest,
}: EstimateGasLimitArgs) =>
  createQueryKey(
    'estimateGasLimit',
    { chainId, transactionRequest },
    { persisterVersion: 1 },
  );

type EstimateGasLimitQueryKey = ReturnType<typeof estimateGasLimitQueryKey>;

// ///////////////////////////////////////////////
// Query Function

async function estimateGasLimitQueryFunction({
  queryKey: [{ chainId, transactionRequest }],
}: QueryFunctionArgs<typeof estimateGasLimitQueryKey>) {
  const provider = getProvider({ chainId });
  const gasLimit = await estimateGas({
    transactionRequest,
    provider,
  });

  if (!gasLimit) {
    if (chainId === ChainId.arbitrum) {
      return `${getChainGasUnits(chainId).basic.eoaTransfer}`;
    }
    return transactionRequest?.data === '0x'
      ? `${getChainGasUnits(chainId).basic.eoaTransfer}`
      : `${getChainGasUnits(chainId).basic.tokenTransfer}`;
  }
  return gasLimit;
}

type EstimateGasLimitResult = QueryFunctionResult<
  typeof estimateGasLimitQueryFunction
>;

// ///////////////////////////////////////////////
// Query Fetcher

export async function fetchEstimateGasLimit(
  { chainId, transactionRequest }: EstimateGasLimitArgs,
  config: QueryConfig<
    EstimateGasLimitResult,
    Error,
    EstimateGasLimitResult,
    EstimateGasLimitQueryKey
  > = {},
) {
  return await queryClient.fetchQuery({
    queryKey: estimateGasLimitQueryKey({ chainId, transactionRequest }),
    queryFn: estimateGasLimitQueryFunction,
    ...config,
  });
}

// ///////////////////////////////////////////////
// Query Hook

export function useEstimateGasLimit(
  { chainId, transactionRequest }: EstimateGasLimitArgs,
  config: QueryConfig<
    EstimateGasLimitResult,
    Error,
    EstimateGasLimitResult,
    EstimateGasLimitQueryKey
  > = {},
) {
  return useQuery({
    queryKey: estimateGasLimitQueryKey({ chainId, transactionRequest }),
    queryFn: estimateGasLimitQueryFunction,
    ...config,
    placeholderData: (previousData) => previousData,
  });
}
