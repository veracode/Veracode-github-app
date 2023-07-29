const { getWorkflowRunById } = require('../services/db-services/db-operations');
const { 
  updateChecksForCompletedScan 
} = require('../services/completed-run-services/completed-scan');
const { updateChecksForCompletedPipelineScan } = 
  require('../services/completed-run-services/completed-pipeline-scan');
const { handleCompletedCompilation } = 
  require('../services/completed-run-services/completed-local-compilation');
const { 
  updateChecksForCompletedPolicyScan, 
} = require('../services/completed-run-services/completed-policy-scan');

async function handleCompletedRun(app, context) {
  if (!context.payload.workflow_run.id) return;

  const workflow_repo_run_id = context.payload.workflow_run.id;

  const run = await getWorkflowRunById(app, workflow_repo_run_id);

  if (!run) return
  app.log.info(new Date().toString()+' - '+run);

  if (run.check_run_type.substring(0, 26) === 'veracode-local-compilation') 
    handleCompletedCompilation(app, run, context);
  else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan')
    updateChecksForCompletedScan(run, context);
  else if (run.check_run_type === 'veracode-sast-policy-scan')
    updateChecksForCompletedPolicyScan(run, context);
  else
    updateChecksForCompletedPipelineScan(run, context);

//   const sha = run.sha;
//   const pullRequests = await context.octokit.search.issuesAndPullRequests({
//     q: `repo:${owner}/${run.repository.name} is:pr ${sha}`,
//   });
//   console.log(pullRequests.data);
}

module.exports = {
  handleCompletedRun,
}