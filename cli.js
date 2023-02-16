/* eslint-disable no-restricted-globals */
const { boolean } = require('yargs');
const lib = require('./lib.js');
const core = require('@actions/core');

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('token', { description: 'token', type: 'string' })
  .option('owner', { description: 'owner', type: 'string' })
  .option('repo', { description: 'repo', type: 'string' })
  .option('apiKey', { description: 'apiKey', type: 'string' })
  .help().argv;

argv.repo = 'action-package-dependency';
lib.showPackageDependencies(argv).catch(console.error);
