module.exports = appConfig;

function appConfig() {
  return {
    // the app name appears in the list of pull request checks. We make it
    // configurable so we can deploy multiple versions that can be used side-by-side
    name: process.env.APP_NAME || "Veracode GitHub App",
    configFileName: ".veracode.yml",
    githubHost: process.env.GITHUB_HOST ?? 'https://github.com',
    defaultOrganisationRepository: process.env.DEFAULT_ORGANISATION_REPOSITORY ?? 'veracode',
    prBranch : process.env.PR_BRANCH ?? 'add-veracode-config',
    appUrl: process.env.APP_URL ?? 'https://github.lz.veracode.io',
    veracodeConfigFile: process.env.VERACODE_CONFIG_FILE ?? 'veracode.yml',
    veracodeEnabledRepoFile: process.env.VERACODE_ENABLED_REPO_FILE ?? 'enabled-repositories.txt',
    cosmodbUri: process.env.COSMOSDB_URI ?? 'mongodb://localhost:27017',
    dbName: process.env.COSMOSDB_DBNAME ?? 'veracode-github-app',
    cloudVendor: process.env.CLOUD_VENDOR ?? 'aws',
    artifactFolder: process.env.ARTIFACT_FOLDER ?? '/tmp/veracode',
  };
}