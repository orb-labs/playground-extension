import { ChainId } from '../types/chains';

const getHost = (endpoint: string) => {
  try {
    const host = new URL(endpoint).host;
    if (host.indexOf('www.') === 0) {
      return host.replace('www.', '');
    }
    return host;
  } catch (e) {
    return '';
  }
};

const isRainbowEndpoint = (endpoint: string) =>
  getHost(endpoint).includes('rainbow.me');

export const proxyRpcEndpoint = (endpoint: string, chainId: ChainId) => {
  // NOTE: you'll need your .env file to have the correct RPC URLs
  return endpoint;
};
