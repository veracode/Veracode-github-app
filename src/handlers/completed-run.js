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
const { getAppConfigFromRepo, getVeracodeScanConfig } = require('../services/config-services/get-veracode-config');
const { getWorkflowRunArtifact } = require('../services/completed-run-services/get-workflow-run-artifacts');

const runTypesNotRequiringErrorHandlingOrResultProcessing = [
  'veracode-remove-sandbox',
  'veracode-not-supported',
];

async function handleCompletedRun(app, context) {
  if (!context.payload.workflow_run.id || context.payload.workflow_run.conclusion === 'cancelled') return;

  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;

  let run = await getWorkflowRunById(app, workflow_repo_run_id);

  if (!run) {
    const workflowMetadata = await getWorkflowRunArtifact(context, 'workflow-metadata', 'workflow-metadata.json');

    if (!workflowMetadata) {
      app.log.info(`This run is neither found in DB nor in Workflow metadata. Run ID: ${workflow_repo_run_id}`);
      return;
    }

    run = {
      repository_owner: workflow_reopo_owner,
      repository_name: workflowMetadata.repository_name,
      check_run_type: workflowMetadata.check_run_type,
      check_run_id: workflowMetadata.check_run_id,
      run_id: workflow_repo_run_id,
      sha: workflowMetadata.sha,
    };
  }
  app.log.info(run);

  if (runTypesNotRequiringErrorHandlingOrResultProcessing.includes(run.check_run_type)) return;

  const runConclusion = context.payload.workflow_run?.conclusion;
  const veracodeAppConfig = await getAppConfigFromRepo(app, context);
  const veracodeScanConfigs = await getVeracodeScanConfig(app, context, veracodeAppConfig);

  if (runConclusion === 'failure') {
    const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/jobs`;
    const workflowRunJobs = await context.octokit.request(url);

    const handleErrorResult = await handleErrorInScan(app, run, context, workflowRunJobs, veracodeScanConfigs);
    if (handleErrorResult.scanFailed)
      return;
  }

  if (run.check_run_type.substring(0, 26) === 'veracode-local-compilation')
    handleCompletedCompilation(app, run, context, veracodeScanConfigs);
  else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan')
    await updateChecksForCompletedScan(run, context, veracodeScanConfigs);
  else if (run.check_run_type === 'veracode-sast-policy-scan') /* This section handles SAST */ {
    if (veracodeAppConfig.process_scan_results_in_action) return;
    updateChecksForCompletedPolicyScan(app, run, context, veracodeScanConfigs);
  }
  else {
    if (veracodeAppConfig.process_scan_results_in_action) return;
    updateChecksForCompletedPipelineScan(app, run, context, veracodeScanConfigs);
  }

}

module.exports = {
  handleCompletedRun,
};