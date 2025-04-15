import { useOrby } from '@orb-labs/orby-react';
import { useEffect, useMemo } from 'react';
import { Chain, HttpTransport, Transport, http } from 'viem';
import { createConfig } from 'wagmi';

import { useRainbowChains } from '~/entries/popup/hooks/useRainbowChains';

import { SUPPORTED_CHAINS } from '../references/chains';
import { useRainbowChainsStore } from '../state';

import { handleRpcUrl } from './clientRpc';

const createChains = (chains: Chain[]): [Chain, ...Chain[]] => {
  return chains.map((chain) => {
    const rpcUrl = handleRpcUrl(chain);
    return {
      ...chain,
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    } as Chain;
  }) as [Chain, ...Chain[]];
};

const createTransports = (chains: Chain[]): Record<number, Transport> => {
  return chains.reduce((acc: Record<number, HttpTransport>, chain) => {
    acc[chain.id] = http(handleRpcUrl(chain));
    return acc;
  }, {});
};

let wagmiConfig = createConfig({
  chains: createChains(SUPPORTED_CHAINS),
  transports: createTransports(SUPPORTED_CHAINS),
});

const updateWagmiConfig = (chains: Chain[]) => {
  wagmiConfig = createConfig({
    chains: createChains(chains),
    transports: createTransports(chains),
  });
};

const WagmiConfigUpdater = () => {
  const { rainbowChains: chains } = useRainbowChains();
  const { addAllCustomRPC } = useRainbowChainsStore();
  const { getVirtualNodeRpcUrlsForSupportedChains } = useOrby();

  const virtualNodeUrls = useMemo(
    () => getVirtualNodeRpcUrlsForSupportedChains(),
    [getVirtualNodeRpcUrlsForSupportedChains],
  );

  useEffect((): void => {
    const rpcs = virtualNodeUrls?.map((virtualNodeUrl) => {
      return {
        rpcUrl: virtualNodeUrl.virtualNodeRpcUrl!,
        chainId: Number(virtualNodeUrl.chainId),
      };
    });

    if (rpcs) {
      addAllCustomRPC(rpcs);
    }
  }, [addAllCustomRPC, virtualNodeUrls]);

  updateWagmiConfig(chains);
  return null;
};

export { wagmiConfig, WagmiConfigUpdater, updateWagmiConfig };
