
export type CallContextPhase = (
  'beforeCall' | 'functionThrow' | 'afterCall'
)

export type ContextType = (
  'block' |
  'context'
);

export type FlowEventType = (
  'COMMENT' |
  'EXPR' |
  'BLOCK_START' |
  'BLOCK_END' |
  'CONTEXT_START' |
  'CONTEXT_END' |
  'RETURN' |
  'BREAK' |
  'THROW' |
  'CONTINUE' |
  'COLLATE' |
  'COND' |
  'UNKNOWN'
);

export enum FlowEventKind {
  COMMENT = 'COMMENT',
  EXPR = 'EXPR',
  BLOCK_START = 'BLOCK_START',
  BLOCK_END = 'BLOCK_END',
  CONTEXT_START = 'CONTEXT_START',
  CONTEXT_END = 'CONTEXT_END',
  RETURN = 'RETURN',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  THROW = 'THROW',
  COLLATE = 'COLLATE',
  UNKNOWN = 'UNKNOWN',
}

export const doNotSet = {};

declare var FinalizationRegistry: any;
export const gcRegConfig = {
  enableFinalization: false,
};
export const gcRegCount = {
  lcvr: 0,
  cce: 0,
  block: 0,
  context: 0,
};
export const gcReg = gcRegConfig.enableFinalization ? new FinalizationRegistry(heldValue => {
  --gcRegCount[heldValue];
}) : null;

export const idRegistry: {[id: string]: string} = {};
const idReleased = [];
export let idCounter = 0;
export function getIdAt() {
  return idCounter;
}
export function getId(from: string) {
  let id;
  if (idReleased.length > 0) {
    const id = idReleased.pop();
    idRegistry[id] = from;
    return id;
  }
  ++idCounter;
  id = `id_${idCounter}`;
  idRegistry[id] = from;
  return id;
}
export function releaseId(id: string): string {
  idReleased.push(id);
  return null;
}
