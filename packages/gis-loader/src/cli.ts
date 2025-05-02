#!/usr/bin/env node

import { program } from 'commander';

program
  .command('download')
  .description('Download GIS data')
  .action(() => {
    // TODO: Implement download command
  });

program.parse(process.argv);
