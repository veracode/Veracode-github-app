const { shouldRunForRepository } = require('../services/config-services/should-run');
const { getDispatchEvents } = require('../services/dispatch-event-services/get-dispatch-events');
const { createDispatchEvent } = require('../services/dispatch-event-services/dispatch');
const { getVeracodeScanConfig, 
  getEnabledRepositoriesFromOrg, getAppConfigFromRepo } = require('../services/config-services/get-veracode-config');
const appConfig = require('../app-config');

async function handleEvents(app, context) {
  const { deleted, 
    repository: { id: repoId, name: repoName, archived, full_name: repoFullName, owner: { login } }, 
    installation: { id: installationId } 
  } = context.payload;

  // 1. handle branch deletion - will not trigger the process
  // 2. handle repository archiving - will not trigger the process
  //    although we should not expect to see push event from an archived repository
  if (archived) return;
  
  
  // 3. handle enabled repositories - if file exists and the repository is not enabled, will not trigger the process
  const enabledRepositories = await getEnabledRepositoriesFromOrg(app, context);
  if (enabledRepositories !== null && !enabledRepositories.includes(repoName)) return;

  // 4. handle excluded repositories - if repository is excluded, will not trigger the process
  const excludedRepositories = [appConfig().defaultOrganisationRepository];
  if(!shouldRunForRepository(repoName, excludedRepositories))
    return;

  // 5. get app config from default organisation repository
  const veracodeAppConfig = await getAppConfigFromRepo(app, context);
  const veracodeScanConfigs = await getVeracodeScanConfig(app, context, veracodeAppConfig);

  const api = context.octokit;
  const token = await api.apps.createInstallationAccessToken({
    installation_id: installationId,
    repository_ids: [repoId]
  })

  const branch = context.name === 'push' ? 
    context.payload.ref.replace('refs/heads/', '') : context.payload.pull_request.head.ref;
  const sha = context.name === 'push' ? context.payload.after : context.payload.pull_request.head.sha;

  let dispatchEvents = [];
  // 5.5 if the pull request is closed, dispatch an event to remove the sandbox
  if ((context.name === 'pull_request' && context.payload.action === 'closed' && context.payload.pull_request?.merged) ||
     (context.name === 'push' && deleted))
    dispatchEvents.push({
      event_type: 'veracode-remove-sandbox',
      repository: appConfig().defaultOrganisationRepository,
      event_trigger: 'veracode-remove-sandbox',
    });
  else dispatchEvents = await getDispatchEvents(app, context, branch, veracodeScanConfigs);

  if (branch === appConfig().prBranch) return
  
  const dispatchEventData = {
    context,
    payload: {
      sha,
      branch,
      token: token.data.token,
      callback_url: `${appConfig().appUrl}/register`,
      // TODO: read veracode.yml to get profile name
      profile_name: repoFullName, 
      repository: {
        owner: login,
        name: repoName,
        full_name: repoFullName,
      }
    }
  }

  const requests = dispatchEvents.map(event => createDispatchEvent(event, dispatchEventData));
  await Promise.all(requests);
}

module.exports = {
  handleEvents,
}