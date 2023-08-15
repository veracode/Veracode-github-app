const appConfig = require('../../app-config');
const mapper = require('../../db/dynamo-client');
const RunDynamo = require('../../models/run.model');
const { dbConnect } = require('../../db/cosmo-client');
const RunCosmo = require('../../models/run.cosmo');

async function getWorkflowRunById(app, workflow_repo_run_id) {
  if (appConfig().cloudVendor === 'aws')
    return await getWorkflowRunByIdAWS(app, workflow_repo_run_id);
  else if (appConfig().cloudVendor === 'azure')
    return await getWorkflowRunByIdAzure(app, workflow_repo_run_id);
  else
    return null;
}

async function getWorkflowRunByIdAWS(app, workflow_repo_run_id) {
  try {
    return await mapper.get(Object.assign(new RunDynamo(), { run_id: workflow_repo_run_id }));
  } catch (error) {
    app.log.error(error.message);
    return null;
  }
}

async function getWorkflowRunByIdAzure(app, workflow_repo_run_id) {
  await dbConnect();
  try {
    return await RunCosmo.findOne({ run_id: workflow_repo_run_id });
  } catch (error) {
    app.log.error(error)
    return;
  }
}

async function saveWorkflowRun(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run) {
  if (appConfig().cloudVendor === 'aws')
    return await saveWorkflowRunAWS(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run);
  else if (appConfig().cloudVendor === 'azure')
    return await saveWorkflowRunAzure(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run);
  else
    return null;
}

async function saveWorkflowRunAWS(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run) {
  const run = new RunDynamo();
  run.run_id = run_id;
  run.sha = sha;
  run.repository_owner = repository_owner;
  run.repository_name = repository_name;
  run.check_run_id = checks_run.data.id;
  run.check_run_type = event_type;
  run.branch = branch;

  await mapper.put({ item: run });
}

async function saveWorkflowRunAzure(run_id, sha, branch, repository_owner, repository_name, event_type, checks_run) {
  await dbConnect();
  const run = new RunCosmo({
    run_id: run_id,
    sha: sha,
    repository_owner: repository_owner,
    repository_name: repository_name,
    check_run_id: checks_run.data.id,
    check_run_type: event_type,
    branch: branch
  });
  await run.save();
}

module.exports = {
  getWorkflowRunById,
  saveWorkflowRun,
}