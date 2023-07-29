module.exports = handleInstallationRepositories;

const pluralize = require('pluralize');
const fs = require('fs');
const path = require('path');
const appConfig = require('../app-config');
const createPR = require('../create-pr');

async function handleInstallationRepositories(app, context) {
  const {
    action,
    repositories_added: added,
    repositories_removed: removed,
    installation: { account, repository_selection: selection },
  } = context.payload;

  const log = context.log.child({
    name: appConfig().name,
    event: context.name,
    action,
    account: account.id,
    accountType: account.type.toLowerCase(),
    accountName: account.login,
    selection: selection,
  });

  if (action === "deleted") {    
    log.info(new Date().toString()+' - '+`😭 ${account.type} ${account.login} uninstalled`);
    return;
  }

  if (action === "removed") {
    log.info(
      `➖ ${account.type} ${account.login} removed ${pluralize(
        "repository",
        removed.length,
        true
      )}`
    );
    return;
  }

  const accountLogin = account.login;
  const addedRepos = removed;
  let repos = added.concat(addedRepos);

  let counter = 0;

  // if(selection === "all"){

  // }
  repos = repos.filter(n => n);
  log.info(new Date().toString()+' - '+repos);
  repos.forEach(async ({name}) => {
    if(name == undefined){
        return;
    }
    const internalName = name;
    context.repo = () => ({ owner: accountLogin, repo: internalName, path: `veracode.yml` });
    context.repo = (val) => ({ owner: accountLogin, repo: internalName, ...val });
    console.log(new Date().toString()+' - '+`running handler for ${name}`)
    return handleInstallation(app, context);
  });
}

/**
 * On install or accepted permissions: update all PRs for installs
 * On uninstall: just log
 *
 * @param {import('probot').Probot} app
 * @param {import('probot').Context} context
 */
async function handleInstallation(app, context) {
  const {
    action,
    repositories,
    repositories_added: added,
    repositories_removed: removed,
    installation: { account, repository_selection: selection },
  } = context.payload;

  const log = context.log.child({
    name: appConfig().name,
    event: context.name,
    action,
    account: account.id,
    accountType: account.type.toLowerCase(),
    accountName: account.login,
    selection: selection,
  });

  const filePath = path.join(__dirname, `../utils/veracode-scan-config.yml`);
  var configtemplate = fs.readFileSync(filePath,'utf8');

  if (action === "added") {
    log.info(
      new Date().toString()+' - '+`➕ ${account.type} ${account.login} added ${pluralize(
        "repository",
        added.length,
        true
      )}`
    );

    if(await context.config(appConfig().configFileName) === null){
      await createPR(context, introPR(configtemplate));
    }

    // return resetRepositories({
    //   app,
    //   context,
    //   account,
    //   repositories: added,
    // });
  }
}

function introPR (content){
  return             {
      file: {
          path: `.github/${appConfig().configFileName}`,
          content: content,
          name: appConfig().configFileName,
          commit_format: "config: adds veracode scan base config to repo"
      },
      pr : {
          body: 'This is the creation of the config file so that we can override settings. This is an optional install...',
          title: 'Intro Veracode app config'
      }
  };
}
