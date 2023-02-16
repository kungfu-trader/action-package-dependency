/* eslint-disable no-restricted-globals */
const github = require('@actions/github');
const fs = require('fs-extra');
const path = require('path');
const git = require('git-client');
// 开启子进程，用于在终端执行格式检查脚本
const { spawnSync } = require('child_process');
const readline = require('readline');
const semver = require('semver');
const axios = require('axios');

async function getConfigFiles(filePath, fileList) {
  try {
    const files = await fs.readdir(filePath);
    for (let idx in files) {
      const filename = files[idx];
      const filedir = path.join(filePath, filename);
      const stats = await fs.stat(filedir);
      var isFile = stats.isFile();
      var isDir = stats.isDirectory();
      if (isFile && filename == 'package.json') {
        fileList.push(filedir);
      } else if (isDir && filename != 'node_modules' && filename != 'dist') {
        await getConfigFiles(filedir, fileList); //递归，如果是文件夹，就继续遍历该文件夹下面的文件
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function getCurrentVersion(cwd) {
  const configPath = path.join(cwd, hasLerna(cwd) ? 'lerna.json' : 'package.json');
  const config = JSON.parse(fs.readFileSync(configPath));
  return semver.parse(config.version);
}

async function checkAndPush(url, dataList, airtableApiKey, check) {
  if ((check && dataList < 10) || dataList.length == 0) {
    return;
  }
  try {
    await createAirtableRecord(url, dataList, airtableApiKey);
    dataList.length = 0;
  } catch (e) {
    console.error(e);
  }
}
async function createAirtableRecord(url, dataList, airtableApiKey) {
  let tryagain = 0;
  while (tryagain < 3) {
    console.log(dataList);
    try {
      const r = await axios.put(
        url,
        {
          performUpsert: {
            fieldsToMergeOn: ['Name', 'Version-without-patch'],
          },
          records: dataList,
        },
        {
          headers: {
            Authorization: `Bearer ${airtableApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`createAirtableRecord ${url} ${r}`);
      return true;
    } catch (e) {
      console.log(e);
      tryagain++;
    }
  }
  return false;
}

async function parseJson(jsonFile) {
  const jsonInfo = fs.readJSONSync(jsonFile);
  const dep = jsonInfo.dependencies;
  console.log(dep);
  const retDeps = [];
  if (dep !== undefined) {
    const packageName = jsonInfo.kungfuCraft ? jsonInfo.kungfuCraft.productName : jsonInfo.name;
    const depFromPackagejson = new Map();
    for (const key in dep) {
      const item = key + '@' + dep[key];
      depFromPackagejson.set(item, key);
    }
    const fileStream = fs.createReadStream('yarn.lock');

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    let preLine;
    for await (const line of rl) {
      const start = line.startsWith('  version "');
      if (start) {
        const lines = preLine.trim().replace(/:/g, '').replace(/"/g, '').split(', ');
        lines.every((l) => {
          if (depFromPackagejson.has(l)) {
            const ver = line.match(/"([^']+)"/)[1];
            retDeps.push(depFromPackagejson.get(l) + '@' + ver);
            return false;
          }
          return true;
        });
      }
      preLine = line;
    }
    const sVer = semver.parse(jsonInfo.version);
    let verWithPatch = sVer.prerelease.length > 0 ? '-' + sVer.prerelease[0] : '';
    verWithPatch = sVer.major + '.' + sVer.minor + verWithPatch;
    const ret = {
      Name: packageName,
      Version: jsonInfo.version,
      Dependencies: JSON.stringify(retDeps),
      'Version-without-patch': verWithPatch,
    };
    console.log(ret);
    return ret;
  }
  return null;
}

exports.showPackageDependencies = async function (argv) {
  // const a = semver.parse('1.2.1-alpha')
  // console.log(a.prerelease[0]);
  const cwd = process.cwd();
  let fileList = [];
  const airtableInfo = [];
  await getConfigFiles(cwd, fileList);
  fileList = fileList.filter(Boolean);
  console.log(fileList);
  const url = 'https://api.airtable.com/v0/appd2XwFJcQWZM8fw/dependencies';

  for (let i = 0; i < fileList.length; i++) {
    const deps = await parseJson(fileList[i]);
    if (deps) {
      deps.Repo = argv.repo;
      airtableInfo.push({ fields: deps });
      await checkAndPush(url, airtableInfo, argv.apiKey, true);
    }
  }
  await checkAndPush(url, airtableInfo, argv.apiKey, false);
  console.log(airtableInfo.length);
};
