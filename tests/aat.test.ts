import { dp, promise, Promise2, Unit } from '@jovian/type-tools';
import { parallel, runWorkflow, sleep, stage, step } from './_lib/pipeline.ritz.default';
import { DefaultWorkflowStateType, Workflow } from './_lib/pipeline.model';
import { context, defer, safe, __ritz_reflect } from '../ritz.default';
import { end, flow, FlowBlockFinalizer, getRuntime } from '../src';
import * as fs from 'fs';

declare var yoyor: any;

// function testDeco(...args): any { return (...args2) => {}; }
// export class StageReflect__ {

//   @__ritz_reflect
//   sadfsadfsdfsdf<T = any>(target?, @testDeco() propertyKey?: () => Promise<string>, @testDeco descriptor: PropertyDescriptor = null): any {

//   };
// }
async function tester() {
  return null;
}

//
function file(test: string) /** sdffsdfs df */ {
  let k = 0;
  for (let i = 0; i < 10; i++) {
    try {
      break;
    } catch (e) {
      i++;
      i--;
      --i;
      -i;
    }
  }
  /**
   * testests
   */
  const yoloy = async () => {
    const toloo = await tester();
    // step('sdfsd');
    const a: any = null;
    // a.sdfsdfsdf.sfds;
  };
  yoloy();
  return '';
}

const a = 0;

// @ritz-ignore
export class TestWorkflow implements Workflow {
  state: DefaultWorkflowStateType;
  data: { [key: string]: any; };
  
  // this is test
  @stage
  stage1() {
    let ii = 0;
    defer(1, 'ms'); {
      ++ii;
    }
    // ['sadfsdfsdf'].must.be(true);
    // for (let i = 0; i < 10; ++i) {
    //   // console.log('cont before');
    //   continue;
    //   // console.log('cont after');
    // }
    // return;
    stage('test22'); {
      // (async () => {
      //   safe; {
      //     console.log('This is still protected?');
      //     setTimeout(() => {
      //       console.log('This is still protected');
      //     }, 1000);
      //   }
      //   setTimeout(() => {
      //     console.log('This is not protected');
      //   }, 1000);
      // })()._.sdfsdf.sdfsdf.sdfsdf.try(100).timeout(3, 's');
      try {
      } catch (e) { console.log(e); }

      // const $returnIf = (test) => stage('test22');
      // $returnIf('sdfsdfsdf') 
      
      // console.log(cococo);
      // let cococo = 5;
      // console.log(__block.id);
      // 0;
      // {
      //   console.log(__block.id);
      // }
      // {
      //   console.log(__block.id);
      // }
      // console.log('before pause');
      // const b = __block;
      // console.log('AAAAAAAAAAAAAAAAAAAAAAAAA', __block.id, __block.parent.id);
      // __block.pause(() => {
      //   console.log('AAAAAAAAAAAAAAAAAAAAAAAAA', __block.id, __block.parent.id);
      //   console.log(__block.paused);
      // });
      // console.log('after pause');

      
    }
    stage('test22'); {
      // end.with stage();
      
    };

    if (true && true) {

    } else if (true) {

    } else if (true) {

    } else {
      
    }
    for (const b in []) {

    }
    for (const b of []) {
      
    }
    do {

    } while(false)
    const ad = 'sdfsdf';
    switch (ad) {
      case 'sdfsdf': break;
    } 
    // do process.memoryUsage(); while(false) 
    // const cc: Promise2[] = [promise(resolve => setTimeout(resolve, 1000)), promise(resolve => setTimeout(resolve, 3000))];
    // for await(const b of cc) {
    //   console.log('AWAITED ' + b);
    // }
    // parallel; {
    //   'test'; {

    //   }
    //   `test ${'sdfsdfsdf'}`; {
        
    //   }
    // }
    const t1 = Date.now();
    for (let i = 0; i < 1;  ++i) {
      file('');
    }

    // console.log(`time taken = ${Date.now() - t1}`);
    // void 0;
    // const bb = { test: 0 };
    // delete bb.test;
    // delete bb.$;
    // console.log('AAAAAAAAAAA', $);
    // console.log('AAAAAAAAAAA', $);
    stage;
    stage; 'sdfsdfsddf'; 'sdfsdf'; {

    }
    stage: 'test';
    stage; `
      test
    `;

    const aa = [];
    // const aaa = arguments[0];
    for (const a of aa) {
      let b = 0;
      let c = 0;
      let cddd = c = 0;
      var e = 0;
      var d = c = 0;
      let f= 9, g = 0, k = c = 9;

      const y: Object & number = 0 as any;

      'sdfsfsdfsd'.$ | ''.$;

      c = 6; c = 9; file(''); c = 0; c = 0;
      
      b ? b : c;
      +b;
      b++;
      ++b;
      c = 0;
      c += 0;
      c -= 0;
      c *= 0;
      c /= 0;
      c %= 0;
      c **= 0;
      typeof c;
      (c as any) instanceof Number;
    }
    if ((aa || true)) {
      let c = 0;
      const b = (c /= 0);
    }

    shell1: {
      shell: 'asdfsadfsadfsadf'.$ > 'sdfasdfasdfsadf'.$
      shell2: {
        shell: 'asdfsadfsadfsadf'.$ > 'sdfasdfasdfsadf'.$
      }
    }
    shell: 'test'
    // console.log($);

    /**
     * some test
     */
    __context;
    // console.log(__context.scopeTrail);
    ;
    // let a;
    // let b;
    let cc = 0;
    /**test*/
    /** test1 */
    /** test2 */
    stage; 'sfsdfsdfsdfsdfsdfsdf';
    // print.$ << file.stream('sdfsdfsdfsdfsdf');
    stage['sdfsdf'];
    // console.log(__context.scopeTrail);
    let a;
    let b;
    const sdfsdfds = a = b;
    stage('test22'); {
        const a = 0;
        step(); () => {
          // console.log('step12323232323')
          return { test: 'test' };
        };
        stage('test2323232323'); () => {
          // console.log('stage within sgage')
          return { test: 'test' };
        }
    }
    step(); {
      // console.log('step1')
    }
    stage('test2'); {
    }
    const bbb = function parallel2(obj): string | number { return null; }
    parallel; {
      'test'; {
        
      }
    }
    interpret: python: {
      // `test`; {

      // }
      // `test`; {
        
      // }
    }
    interpret: sh2: {
      // continue sh2;
    }
    $sh: true;
    // continue $sh;
    pipeline:                       {
      stage: 'sdfsdfsdfsdfsdfsdf'; {
        
      }
    }

    const obj = {
      asdfsafsadf: async () => {
        stage('tests'); {
          
        }
      }
    };
    
    
    const k = {};
    
  }

  @stage({ when: (wf) => wf.data })
  async 'this is the name of the sage'() {
    
    let aaa: Function;
    const aa = [];
    class Test {
      canbeAsync() {
        sleep(5);
      }
    }

    for (const a in aa) {

    }
    if (' ' in aa) {

    }
    (aa)
    // const thisIsString = 'sdfsdfsdfsdfsfsdf'
    // stage('test'); {
    //   const a = 0;
    // }
    // gitlab
    // gitlab.test();
    // gitlab.second.test();
    // parallel; {
    //   'task'; {
    //       sleep(2);
    //       const a = 0;
    //   }
    //   `task2 ${thisIsString}`; {
    //       sleep(4);
    //       const a = 0;
    //   }
    // }
    // // $return >> file('');
    
    // const a = 0;
  }

  async post() {
    // const bbb = () => '';
    // const a = 0;
    // const a = 0;
  }

  async finalReturn() {
    return 'test';
  }
}

let activated = false;
setTimeout(async () => {
  context; {
    // flow.cadence('context', 'EXPR', 10);
    // flow.cadence('context', { 'BLOCK_END': 10 });
    flow.finally(useThisFinalizer());
    // console.log('workflow started');
    const loopCount = 1 // 10000000// 3;
    const rt = getRuntime();
    rt.sharedData.wfCount = 0;
    let e2: Error;
    for (let i = 0 ; i < loopCount; ++i) {
      // console.log(`run ${i}`);
      // @ritz-ignore
      try { 
        ++rt.sharedData.wfCount;
        await runWorkflow(TestWorkflow);
      } catch (e) {
        if (!e2) {
          console.log(e);
          e2 = e;
        }
        // console.log(e);
      }
      // console.log(a);
      // sleep(0.5);
    }
    console.log('workflow ended');
  }
}, 10);

function useThisFinalizer(): FlowBlockFinalizer {
  return {
    onThrow: async (e) => {
      console.log('finalizer on error case');
    },
    onReturn: async (r) => {
      console.log('finalizer on result case');
    },
  };
}

export const runner = 0;

// (async ()=>{
//   stage('outside stage'); {
//   }
//   step('outside step'); {
//     const r1 = 'abc' in 'abcde'.$;
//     console.log('r1', r1);
//     const r2 = 'abc' in ['abc', 'sdfsdfsdf', 'sdfsdfsdf'];
//     console.log('r2', r2);
//     const r3 = 'abc' in {abc: 0};
//     console.log('r3', r3);
//   }
// })();

// var v8 = require('v8');
// function createHeapSnapshot() {
//   global.gc();
//   activated = true;
//   console.log('GCed, creating snapshot...');
//   v8.writeHeapSnapshot(`heapdump-${Date.now()}.heapsnapshot`);
//   console.log('snapshot piped');
// }

// setTimeout(() => {
//   createHeapSnapshot();
// }, 1500);
