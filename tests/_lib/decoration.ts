import { getRuntime } from "../../src"

export const testConfigDeco = (data?: any) => {
  if (data !== undefined) {
    return getRuntime().addDecoration({ decorationKind: 'config', data });
  } else {
    return getRuntime().addDecoration({ decorationKind: 'config' });
  }
}

