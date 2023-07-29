const mapper = require('../db/dynamo-client');
const Run = require('../models/run.model');
const appConfig = require('../app-config');
const { saveWorkflowRun } = require('../services/db-services/db-operations');

async function handleRegister (req, res, { app }) {
  const { 
    run_id, 
    name, 
    sha, 
    branch,
    enforce, 
    enforce_admin,
    repository_owner,
    repository_name,
    event_type
  } = req.query

  const data = {
    owner: repository_owner,
    repo: repository_name,
    head_sha: sha,
    name: name,
    details_url: `${appConfig().githubHost}/${repository_owner}/${appConfig().defaultOrganisationRepository}/actions/runs/${run_id}`,
    status: 'in_progress'
  }

  let octokit = await app.auth();
  const installation = await octokit.apps.getRepoInstallation({
    owner: repository_owner, 
    repo: repository_name
  })
  octokit = await app.auth(installation.data.id)

  const checks_run = await octokit.checks.create(data);

  try {
    await saveWorkflowRun(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run);
    return res.sendStatus(200);
  } catch (error) {
    app.log.error(new Date().toString()+' - '+error);
    return response.status(500).json({err: 'DatabaseError'})
  }
}

module.exports = {
  handleRegister,
}
