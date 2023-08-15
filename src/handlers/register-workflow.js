const appConfig = require('../app-config');

async function handleRegisterWorkflow(app, context) {
  const {
    workflow_run: { id: runId, name: workflowRunName, check_suite_id},
    workflow: { name: workflowName},
    repository: { owner: { login } }
  } = context.payload;

  // Regular expression pattern to match repository and SHA
  const regex = /Repo\s(.*?)\s-\sSha\s(.*?)$/;

  // Match the pattern against the input string
  const match = workflowRunName.match(regex);

  let repositoryName;
  let sha;

  if (match) {
    repositoryName = match[1];
    sha = match[2];
  } else {
    console.log('Repository and Sha not found in the WorkflowRunName.');
    return;
  }

  const data = {
    owner: login,
    repo: repositoryName,
    head_sha: sha,
    name: workflowName,
    details_url: `${appConfig().githubHost}/${login}/${appConfig().defaultOrganisationRepository}/actions/runs/${runId}`,
    status: 'in_progress'
  }

  const checks_run = await context.octokit.checks.create(data);
  console.log(checks_run.data.id);
}

module.exports = {
  handleRegisterWorkflow,
}