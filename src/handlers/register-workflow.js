const appConfig = require('../app-config');
const { saveWorkflowRun, getWorkflowRunById } = require('../services/db-services/db-operations');

async function handleRegisterWorkflow(app, context) {
  const {
    workflow_run: { id: runId, name: workflowRunName},
    workflow: { name: workflowName},
    repository: { owner: { login: owner } }
  } = context.payload;

  const run = await getWorkflowRunById(app, runId);
  if (run) return;

  // Regular expression pattern to match repository and SHA
  const regex = /Repo\s(.*?)\s-\sSha\s(.*?)\s-\sBranch\s(.*?)\s-\sEvent\s(.*?)$/;

  // Match the pattern against the input string
  const match = workflowRunName.match(regex);

  let repositoryName;
  let sha;
  let branch;
  let event;

  if (match) {
    repositoryName = match[1];
    sha = match[2];
    branch = match[3];
    event = match[4];
  } else {
    console.log('Repository and Sha not found in the WorkflowRunName.');
    return;
  }

  const data = {
    owner,
    repo: repositoryName,
    head_sha: sha,
    name: workflowName,
    details_url: `${appConfig().githubHost}/${owner}/${appConfig().defaultOrganisationRepository}/actions/runs/${runId}`,
    status: 'in_progress'
  }

  const checks_run = await context.octokit.checks.create(data);
  try {
    await saveWorkflowRun(runId, sha, branch, owner, repositoryName, event, checks_run);
    return;
  } catch (error) {
    app.log.error(error);
    return;
  }
}

module.exports = {
  handleRegisterWorkflow,
}