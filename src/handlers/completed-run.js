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
const { handleErrorInScan } = require('../services/completed-run-services/handle-error-in-scan');
const { getVeracodeScanConfig } = require('../services/config-services/get-veracode-config');

async function handleCompletedRun(app, context) {
  if (!context.payload.workflow_run.id) return;

  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;

  const run = await getWorkflowRunById(app, workflow_repo_run_id);
  if (!run) return
  app.log.info(run);

  const runConclusion = context.payload.workflow_run?.conclusion;
  const veracodeScanConfigs = await getVeracodeScanConfig(app, context);

  if (runConclusion === 'failure') {
    const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/jobs`
    const workflowRunJobs = await context.octokit.request(url);

    const handleErrorResult = await handleErrorInScan(app, run, context, workflowRunJobs, veracodeScanConfigs);
    if (handleErrorResult.scanFailed)
      return;
  }

  if (run.check_run_type.substring(0, 26) === 'veracode-local-compilation') 
    handleCompletedCompilation(app, run, context);
  else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan')
    await updateChecksForCompletedScan(run, context, veracodeScanConfigs);
  else if (run.check_run_type === 'veracode-sast-policy-scan') /* This section handles SAST */
    updateChecksForCompletedPolicyScan(run, context, veracodeScanConfigs);
  else
    updateChecksForCompletedPipelineScan(run, context);
}

module.exports = {
  handleCompletedRun,
}