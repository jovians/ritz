import { FlowBlockFinalizer } from "../src";

export function useThisFinalizer(): FlowBlockFinalizer {
  return {
    onThrow: async (e) => {
      console.log('finalizer on error case');
    },
    onReturn: async (r) => {
      console.log('finalizer on result case');
    },
  };
}