const { getWorkflowRunById } = require('../services/db-services/db-operations');
const { updateChecks } = require('../services/check-services/checks');
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
const fs = require('fs').promises;
const { getVeracodeScanConfig } = require('../services/config-services/get-veracode-config');

async function handleCompletedRun(app, context) {
  if (!context.payload.workflow_run.id) return;

  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;

  const run = await getWorkflowRunById(app, workflow_repo_run_id);
  if (!run) return
  app.log.info(run);

  const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/jobs`
  const workflowRunJobs = await context.octokit.request(url);

  if (run.check_run_type.substring(0, 26) === 'veracode-local-compilation') 
    handleCompletedCompilation(app, run, context);
  else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan') {
    const logMessageEnumerationFilePath = 'src/utils/log-message-enumeration.json';
    const logMessageEnumeration = JSON.parse(await fs.readFile(logMessageEnumerationFilePath));
    let failedJob = workflowRunJobs.data.jobs.find(job => job.conclusion === 'failure');
    const logUrl = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/jobs/${failedJob.id}/logs`
    const log = await context.octokit.request(logUrl);

    let scanRunIntoErrorMessage = '';
    const lines = log.data.split('\n');

    lines.forEach(line => {
      logMessageEnumeration.SCAIAC.errorMessage.forEach(errorMsg => {
        if (line.includes(errorMsg)) {
          scanRunIntoErrorMessage += line + '\n';
        }
      });
    });

    if (scanRunIntoErrorMessage === '') {
      updateChecksForCompletedScan(run, context);
      return;
    }

    const veracodeScanConfigs = await getVeracodeScanConfig(app, context);
    scanRunIntoErrorMessage += '\n' + veracodeScanConfigs.veracode_sca_scan.error_message + '\n';
    const output = {
      title: run.check_run_type === 'veracode-sca-scan' ? 
        'Failed to Complete Veracode SCA Scan' : 'Failed to Complete Veracode IAC Secrets Scan',
      summary: scanRunIntoErrorMessage
    }
    await updateChecks(run, context, output);
  }
  else { /* This section handles SAST */
    const runConclusion = context.payload.workflow_run?.conclusion;
    if (runConclusion === 'failure') {
      let failedJob = workflowRunJobs.data.jobs.find(job => job.conclusion === 'failure');

      if (failedJob.name.includes('build')) {
        const output = {
          title: 'Build Failed',
          summary: `The packing for Veracode SAST scan failed, please review the individual action and  Scan on the Veracode platform. Please also review the Veracode package guidance https://docs.veracode.com/r/compilation_packaging and talk to your Veracode team to get this security scanned.`
        }
        await updateChecks(run, context, output);
        return;
      }
    }
    if (run.check_run_type === 'veracode-sast-policy-scan')
      updateChecksForCompletedPolicyScan(run, context, workflowRunJobs);
    else
      updateChecksForCompletedPipelineScan(run, context, workflowRunJobs);
  }

//   const sha = run.sha;
//   const pullRequests = await context.octokit.search.issuesAndPullRequests({
//     q: `repo:${owner}/${run.repository.name} is:pr ${sha}`,
//   });
//   console.log(pullRequests.data);
}

module.exports = {
  handleCompletedRun,
}