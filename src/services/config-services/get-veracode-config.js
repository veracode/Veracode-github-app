const appConfig = require('../../app-config');
const fs = require('fs');
const yaml = require('js-yaml');

async function getVeracodeScanConfig(app, context, veracodeAppConfig) {
  const octokit = context.octokit;
  const owner = context.payload.repository.owner.login;
  const originalRepo = context.payload.repository.name;
  let veracodeScanConfigs;
  // 1. get veracode.yml from original repository
  let veracodeConfigFromRepo = await getConfigFileFromRepo(
    app, octokit, owner, originalRepo, veracodeAppConfig.scan_config_file_location);
  // 2. if veracode.yml does not exist in original repository, get veracode.yml from default organization repository
  if (veracodeConfigFromRepo === null) 
    veracodeConfigFromRepo = await getConfigFileFromRepo(
      app, octokit, owner, appConfig().defaultOrganisationRepository, veracodeAppConfig.scan_config_file_location);

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

async function getEnabledRepositoriesFromOrg(app, context) {
  const octokit = context.octokit;
  const owner = context.payload.repository.owner.login;

  const enabledRepositoriesFile = await getConfigFileFromRepo(app, octokit, owner,
    appConfig().defaultOrganisationRepository, appConfig().veracodeEnabledRepoFile);
  if (enabledRepositoriesFile === null) return null;

  const fileContents = Buffer.from(enabledRepositoriesFile.data.content, 'base64').toString();
  const enabledRepositories = fileContents.split('\n');
  return enabledRepositories;
}

async function getAppConfigFromRepo(app, context) {
  const octokit = context.octokit;
  const owner = context.payload.repository.owner.login;
  const defaultAppConfig = {
    scan_config_file_location: 'veracode.yml',
    process_scan_results_in_action: false,
  };
  const appConfigFile = await getConfigFileFromRepo(app, octokit, owner, 
    appConfig().defaultOrganisationRepository, appConfig().appConfigFile);
  if (appConfigFile === null) return defaultAppConfig;
  try {
    const fileContents = Buffer.from(appConfigFile.data.content, 'base64').toString();
    return yaml.load(fileContents);
  } catch (e) {
    app.log.error(e);
    return defaultAppConfig;
  }
}

async function getConfigFileFromRepo(app, octokit, owner, repository, configFile) {
  let config;
  try {
    config = await octokit.repos.getContent({
      owner,
      repo: repository,
      path: configFile,
    });
  } catch (error) {
    app.log.error(`${configFile} not found in repo ${repository}`);
    return null;
  }
  return config;
}

module.exports = {
  getVeracodeScanConfig,
  getEnabledRepositoriesFromOrg,
  getAppConfigFromRepo
}