import { Address } from 'viem';
import create from 'zustand';

import { createStore } from '~/core/state/internal/createStore';

import { withSelectors } from '../internal/withSelectors';

interface PersistedAddressState {
  currentAddress: Address;
  currentAddresses: Address[];
  setCurrentAddress: (address: Address) => void;
  setCurrentAddresses: (addresses: Address[]) => void;
}

const persistedAddressStore = createStore<PersistedAddressState>(
  (set) => ({
    currentAddress: '' as Address,
    currentAddresses: [],
    setCurrentAddress: (newAddress) => set({ currentAddress: newAddress }),
    setCurrentAddresses: (currentAddresses) =>
      set({ currentAddresses: currentAddresses }),
  }),
  {
    persist: {
      name: 'currentAddress',
      version: 0,
    },
  },
);

interface RapidAddressState {
  currentAddress: Address;
  currentAddresses: Address[];
  setCurrentAddress: (address: Address) => void;
  setCurrentAddresses: (addresses: Address[]) => void;
}

export const currentAddressStore = create<RapidAddressState>((set) => ({
  currentAddress:
    // Default to the persisted current address
    persistedAddressStore.getState().currentAddress || ('' as Address),
  currentAddresses:
    // Default to the persisted current address
    persistedAddressStore.getState().currentAddresses || [],
  setCurrentAddress: (newAddress) => {
    if (newAddress !== persistedAddressStore.getState().currentAddress) {
      set({ currentAddress: newAddress });
      // Automatically persist in the background to the persisted store
      persistedAddressStore.getState().setCurrentAddress(newAddress);
    }
  },
  setCurrentAddresses: (newAddresses) => {
    set({ currentAddresses: newAddresses });
    // Automatically persist in the background to the persisted store
    persistedAddressStore.getState().setCurrentAddresses(newAddresses);
  },
}));

// Synchronize currentAddress with persistedAddress once rehydrated
persistedAddressStore.subscribe((state) => {
  // If persistedAddress changes and currentAddress is still the default, update it
  if (currentAddressStore.getState().currentAddress === ('' as Address)) {
    currentAddressStore.setState({
      currentAddress: state.currentAddress,
      currentAddresses: state.currentAddresses,
    });
  }
});

export const useCurrentAddressStore = withSelectors(currentAddressStore);
