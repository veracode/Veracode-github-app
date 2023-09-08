const { getVeracodeScanConfig, 
  getEnabledRepositoriesFromOrg, getAppConfigFromRepo } = require('../services/config-services/get-veracode-config');
const appConfig = require('../app-config');
const { shouldRunForRepository } = require('../services/config-services/should-run');
const { getDispatchEvents } = require('../services/dispatch-event-services/get-dispatch-events');
const { getBranchByName } = require('../services/branch-services/get-branch');
const { createDispatchEvent } = require('../services/dispatch-event-services/dispatch');

async function handleIssueEvents(app, context) {
  const {
    repository: { id: repoId, name: repoName, full_name: repoFullName, owner: { login } }, 
    installation: { id: installationId } 
  } = context.payload;

  // 1. handle enabled repositories - if file exists and the repository is not enabled, will not trigger the process
  const enabledRepositories = await getEnabledRepositoriesFromOrg(app, context);
  if (enabledRepositories !== null && !enabledRepositories.includes(repoName)) return;

  // 2. handle excluded repositories - if repository is excluded, will not trigger the process
  const excludedRepositories = [appConfig().defaultOrganisationRepository];
  if(!shouldRunForRepository(repoName, excludedRepositories))
    return;

  // 3. get app config from default organisation repository
  const veracodeAppConfig = await getAppConfigFromRepo(app, context);

  // 4. get scan configs from veracode.yml
  const veracodeScanConfigs = await getVeracodeScanConfig(app, context, veracodeAppConfig);

  // 5. get token for the repository in the context
  const api = context.octokit;
  const token = await api.apps.createInstallationAccessToken({
    installation_id: installationId,
    repository_ids: [repoId]
  });

  const eventType = context.name;
  app.log.info(`Received ${eventType} event`)
  let attributesToCheck = [];
  if (eventType === 'issues') {
    // add context.payload.issue.title and context.payload.issue.body to attributesToCheck if not null or undefined
    if (context.payload.issue?.title !== undefined && context.payload.issue?.title !== null ) 
      attributesToCheck.push(context.payload.issue.title);
    if (context.payload.issue?.body !== undefined && context.payload.issue?.body !== null) 
      attributesToCheck.push(context.payload.issue.body);
  } else if (eventType === 'issue_comment') {
    if (context.payload.comment?.body !== undefined && context.payload.comment?.body !== null)
      attributesToCheck.push(context.payload.comment.body);
  }

  // 6. get dispatch events calculated from veracode.yml
  const dispatchEvents = await getDispatchEvents(app, context, undefined, veracodeScanConfigs, attributesToCheck);

  for (let index = 0; index < dispatchEvents.length; index++) {
    const dispatchEvent = dispatchEvents[index];
    let branchName = '';
    const branchRegex = /branch:\s*([\w-]+)/;
    attributesToCheck.forEach(attribute => {
      const match = attribute.match(branchRegex);

      if (match) {
        branchName = match[1];
        return;
      }
    });
    let branch = undefined;
    if (branchName) {
      try {
        branch = await getBranchByName(app, context, branchName);
      } catch (error) {
        branch = undefined;
      }
    } 
    
    if (!branch) {
      app.log.info(`Branch ${branchName} not found, using default branch`);
      branch = await getBranchByName(app, context, context.payload.repository.default_branch);
    }

    const dispatchEventData = {
      context,
      payload: {
        sha: branch.commit.sha,
        branch: branch.name,
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
    };
    await createDispatchEvent(dispatchEvent, dispatchEventData);
  }
}

module.exports = {
  handleIssueEvents,
}