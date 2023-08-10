const { updateChecksForCompletedSastScan } = 
  require('../check-services/update-checks-with-artifact');
const { getVeracodeScanConfig } = require('../config-services/get-veracode-config');
const { updateChecks } = require('../check-services/checks');
const fs = require('fs').promises;

async function updateChecksForCompletedScan (app, run, context, workflowRunJobs) {

  const runConclusion = context.payload.workflow_run?.conclusion;
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;

  const veracodeScanConfigs = await getVeracodeScanConfig(app, context);

  if (runConclusion === 'failure') {
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

    /* If there are defined error message in the retrieved log,
     * update the check run with the error message and return.
     * The below is only processing SCA Failed Scenarios.
     * TODO: Add IAC Secrets Failed Scenarios.
    */
    if (scanRunIntoErrorMessage !== '') {
      scanRunIntoErrorMessage += `\n${veracodeScanConfigs.veracode_sca_scan.error_message}\n`;
      const output = {
        title: run.check_run_type === 'veracode-sca-scan' 
          ? 'Failed to Complete Veracode SCA Scan' 
          : 'Failed to Complete Veracode IAC Secrets Scan',
        summary: scanRunIntoErrorMessage
      }
      const conclusion = veracodeScanConfigs.veracode_sca_scan.break_build_on_error ? 'failure' : 'success';
      await updateChecks(run, context, output, conclusion);
      return;
    }
  }

  let scaScanConfig;
  if (run.check_run_type === 'veracode-sca-scan') {
    scaScanConfig = {
      artifactName: 'Veracode Agent Based SCA Results',
      findingFileName: null,
      resultsUrlFileName: 'scaResults.txt',
      errorArtifactName: 'veracode-error',
      errorFileName: 'error.txt',
      title: 'Veracode Software Composition Analysis',
      getAnnotations: function(json) {
        return [];
      }
    }
  } else if (run.check_run_type === 'veracode-iac-secrets-scan') {
    scaScanConfig = {
      artifactName: 'Veracode Container IaC Secrets Scanning Results',
      findingFileName: null,
      resultsUrlFileName: 'results.txt',
      errorArtifactName: 'veracode-error',
      errorFileName: 'error.txt',
      title: 'Veracode IaC Secrets Scanning',
      getAnnotations: function(json) {
        return [];
      }
    }
  }
  await updateChecksForCompletedSastScan(run, context, scaScanConfig, veracodeScanConfigs);
}

module.exports = {
  updateChecksForCompletedScan,
}