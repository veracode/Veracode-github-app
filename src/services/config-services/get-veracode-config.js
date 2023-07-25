const appConfig = require('../../app-config');
const fs = require('fs');
const yaml = require('js-yaml');

async function getVeracodeScanConfig(app, context) {
  const octokit = context.octokit;
  const owner = context.payload.repository.owner.login;
  const originalRepo = context.payload.repository.name;
  let veracodeScanConfigs;
  // 1. get veracode.yml from original repository
  let veracodeConfigFromRepo = await getVeracodeConfigFromRepo(
    app, octokit, owner, originalRepo);
  // 2. if veracode.yml does not exist in original repository, get veracode.yml from default organization repository
  if (veracodeConfigFromRepo === null) 
    veracodeConfigFromRepo = await getVeracodeConfigFromRepo(
      app, octokit, owner, appConfig().defaultOrganisationRepository);

  if (veracodeConfigFromRepo === null) {
    try {
      const veracodeConfigFile = 'src/utils/veracode-scan-config.yml';
      const fileContents = fs.readFileSync(veracodeConfigFile, 'utf8');
      veracodeScanConfigs = yaml.load(fileContents);
    } catch (e) {
      app.log.error(e);
      return;
    }
  } else {
    try {
      const fileContents = Buffer.from(veracodeConfigFromRepo.data.content, 'base64').toString();
      veracodeScanConfigs = yaml.load(fileContents);
    } catch (e) {
      app.log.error(e);
      return;
    }
  }
  return veracodeScanConfigs;
}

async function getVeracodeConfigFromRepo(app, octokit, owner, repository) {
  let veracodeConfig; 
  try {
    veracodeConfig = await octokit.repos.getContent({
      owner,
      repo: repository,
      path: appConfig().veracodeConfigFile,
    });
  } catch (error) {
    app.log.info(`${appConfig().veracodeConfigFile} not found`);
    return null;
  }

  return veracodeConfig;
}

module.exports = {
  getVeracodeScanConfig
}