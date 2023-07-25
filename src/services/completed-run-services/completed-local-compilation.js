const { createDispatchEvent } = require('../dispatch-event-services/dispatch');
const appConfig = require('../../app-config');
const { getVeracodeScanConfig } = require('../config-services/get-veracode-config');


async function handleCompletedCompilation (app, run, context) {
  const data = {
    owner: run.repository_owner,
    repo: run.repository_name,
    check_run_id: run.check_run_id,
    status: context.payload.workflow_run?.status,
    conclusion: context.payload.workflow_run?.conclusion,
  }

  const repoId = context.payload.repository.id;
  const installationId = context.payload.installation.id;

  const api = context.octokit;

  const token = await api.apps.createInstallationAccessToken({
    installation_id: installationId,
    repository_ids: [repoId]
  })

  await context.octokit.checks.update(data);

  if (data.conclusion === 'failure') return;

  const dispatchEventData = {
    context,
    payload: {
      token: token.data.token,
      sha: run.sha,
      branch: run.branch,
      callback_url: `${appConfig().appUrl}/register`,
      profile_name: context.payload.repository.full_name, 
      run_id: run.run_id,
      repository: {
        owner: context.payload.repository.owner.login,
        name: context.payload.repository.name,
        full_name: context.payload.repository.full_name,
      }
    }
  }

  const veracodeScanConfigs = await getVeracodeScanConfig(app, context);
  const subsequentScanType = run.check_run_type.substring(27);
  const subsequentScanTypeUnderscore = subsequentScanType.replaceAll(/-/g, '_');
  const dispatchEvents = [{
    event_type: subsequentScanType,
    repository: appConfig().defaultOrganisationRepository,
    event_trigger: `binary-ready-${subsequentScanType}`,
    modules_to_scan: veracodeScanConfigs[subsequentScanTypeUnderscore].modules_to_scan
  }]

  let requests = dispatchEvents.map(event => createDispatchEvent(event, dispatchEventData));
  await Promise.all(requests);
}

module.exports = {
  handleCompletedCompilation,
}