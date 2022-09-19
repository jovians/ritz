import { CCE, getRuntime, RitzOperatorRubric, __BlockContext, __ScopeContext } from '../../src';
import { idCounter, idRegistry } from '../../src/ritz/private.models';

class CustomOpRubric extends RitzOperatorRubric {
  async '>'(cce: CCE, a, b) {
    // console.log('> invoked under shell');
    return a > b;
  }
}
const shellOps = new CustomOpRubric();

const rt = getRuntime();
const ectx = 'test';
rt.addBeforeAnyCall(ectx, e => {
  // console.log('before', e.funcImportedName, e.args.final.slice(1));
});
rt.addAfterAnyCall(ectx, e => {
  // console.log('after', e.funcImportedName, e.args.final.slice(1), e.result.final);
});
rt.addFlowTracker(ectx, e => {
  const tsFile = e.blockContext.sourceFile.file.ritzTs;
  const location = tsFile+ ':' + e.sourceLocation;
  // console.log('flow', e.type, `${e.flowId} '${location}'`, e.info?.slice?.(0, 40).split('\n').join('\\n'));
});
rt.provideLabeledContext('shell', ctx => {
  ctx.currentOperatorRubric = shellOps;
});

function outputMem() {
  // return;
  // eval('%CollectGarbage(true)');
  // global.gc();
  const rt = getRuntime();
  const cpu = process.cpuUsage();
  const mem = process.memoryUsage();
  const idmap = {};
  for (const key of Object.keys(idRegistry)) {
    const from = idRegistry[key];
    if (!idmap[from]) { idmap[from] = 0; }
    ++idmap[from];
  }
  // const unfinished = [];
  // for (const blkId of Object.keys(__BlockContext.allUnfinishedBlocks)) {
  //   if (__BlockContext.allUnfinishedBlocks[blkId]) {
  //     unfinished.push(__BlockContext.allUnfinishedBlocks[blkId].flowId);
  //   }
  // }
  // console.log(unfinished);
  const count = Object.keys(__BlockContext.allUnfinishedBlocks).length;
  const count2 = Object.keys(rt.blocks).length;
  const count3 = Object.keys(__ScopeContext.allUnfinishedContexts).length;
  const count5 = Object.keys(rt.currentFlowTrackingEventById).length;
  console.log(
    rt.elapsed,
    rt.metrics.flow.count,
    rt.sharedData.wfCount,
    `${Math.floor(mem.heapUsed * 10 / 1024 / 1024) / 10} MiB / ${Math.floor(mem.heapTotal * 10 / 1024 / 1024) / 10} MiB`,
    'UB', count,
    'BLOCKS', count2,
    'UCTX', count3,
    'UFE', count5,
    'CPU (User)', cpu.user,
    'CPU (System)', cpu.system,
    'idc', idCounter,
    // 'cce', gcRegCount.cce,
    // 'block', gcRegCount.block,
    // 'ctx', gcRegCount.context,
    // 'lcvr', gcRegCount.lcvr,
    `${rt.metrics.blocks.totalOpened}/${rt.metrics.blocks.totalClosed}`,
    `${rt.metrics.contexts.totalOpened}/${rt.metrics.contexts.totalClosed}`,
    idmap,
    // `${Object.keys(__ScopeContext.allUnfinishedContexts).map(k => __ScopeContext.allUnfinishedContexts[k].scope)}`,
  );
}

// setInterval(() => {
//   console.log('GC');
//   eval('%CollectGarbage(true)');
// }, 15000)

export const shower = () => {
  outputMem()
}

setInterval(() => {
  outputMem()
}, 1000);

// setInterval(() => {
//   for (const key in __BlockContext.allPauses) {
//     console.log('resumed', key, __BlockContext.allPauses[key].pauseTime);
//     __BlockContext.allPauses[key].resume();
//   }
//   console.log(
//     `${rt.metrics.blocks.totalOpened}/${rt.metrics.blocks.totalClosed}`,
//     `${rt.metrics.contexts.totalOpened}/${rt.metrics.contexts.totalClosed}`,
//   );
// }, 1000);
