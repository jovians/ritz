#! /usr/bin/env node
// RITZ SKIP
/* Jovian (c) 2020, License: MIT */
import { Command } from 'commander';
import { version } from './package.json';
import { Ritz, RitzCli } from './src';

Ritz.compilerVersion = version;

const program = new Command()
  .name('ritz')
  .description(`Ritz transform utility CLI v${version}`)
  .version(version);

  RitzCli.loadCommand(program, 'run');
  RitzCli.loadCommand(program, 'transform');
  RitzCli.loadCommand(program, 'revert');
  RitzCli.loadCommand(program, 'recompile');

program.parse();
