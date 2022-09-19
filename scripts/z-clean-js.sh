#!/bin/bash
rm -rf index.js*;
rm -rf ./*.js;
rm -rf ./*.map;
find src -name '*.map' -delete;
find src -name '*.js' -delete;
find tests -name '*.js' -delete;
find tests -name '*.map' -delete;
