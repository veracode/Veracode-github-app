const fs = require('fs').promises;
const { updateChecks } = require('../check-services/checks');

/* This function handles the error in the scan, make sure the scan is kicked off and completed.
 * If there are any errors during the workflow job, update checks to reflect what happened in the workflow run. 
 * This failure excludes failed build from the scan results */
async function handleErrorInScan (app, run, context, workflowRunJobs, veracodeScanConfigs) {
  
  const failedJob = workflowRunJobs.data.jobs.find(job => job.conclusion === 'failure');

  const scanEventType = run.check_run_type.replaceAll(/-/g, '_');
  const conclusion = veracodeScanConfigs[scanEventType].break_build_on_error ? 'failure' : 'success';

  /* If the failed job is the build job, then it is a SAST run;
   * we need to update the check run with the error message and return. */
  if (failedJob.name.includes('build')) {
    const output = {
      title: 'Build Failed',
      summary: `The packing for Veracode SAST scan failed, please review the individual action and  Scan on the Veracode platform. Please also review the Veracode package guidance https://docs.veracode.com/r/compilation_packaging and talk to your Veracode team to get this security scanned.`
    }
    await updateChecks(run, context, output, conclusion);
    return { "scanFailed": true };
  }

  /* If the failed job is not the build job, then we need to capture the error message
   * in the run log and update the check run with the error message. */
  /* Step 1: Read the log message enumeration file that contains the error to search */
  const logMessageEnumerationFilePath = 'src/utils/log-message-enumeration.json';
  const logMessageEnumeration = JSON.parse(await fs.readFile(logMessageEnumerationFilePath));

  let scanType;
  if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan')
    scanType = 'SCA_IAC';
  else if (run.check_run_type === 'veracode-sast-policy-scan')
    scanType = 'SAST_POLICY';
  else
    scanType = 'SAST_PIPELINE';

  const errorMessagesToSearch = logMessageEnumeration[scanType].errorMessage;

  /* Step 2: Read the log file from the failed job */
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const logUrl = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/jobs/${failedJob.id}/logs`
  const log = await context.octokit.request(logUrl);

  let scanRunIntoErrorMessage = '';
  const lines = log.data.split('\n');

  /* Step 3: Search the error message in the log file */
  lines.forEach(line => {
    /* When this message is detected in the log, it means the Policy Scan completed, but 
     * Fail Build Flag was set to True, so that the pipeline stopped.*/
    if (line.includes('Policy Violation: Veracode Policy Scan Failed'))
      return { "scanFailed": false }; 
    errorMessagesToSearch.forEach(errorMsg => {
      if (line.includes(errorMsg)) {
        scanRunIntoErrorMessage += line + '\n';
      }
    });
  });

  /* Step 4: If there are defined error message in the retrieved log, update the check 
   * run with the error message plus the customised message in the yml config file */
  if (scanRunIntoErrorMessage !== '') {
    scanRunIntoErrorMessage += `\n${veracodeScanConfigs[scanEventType].error_message}\n`;
    const output = {
      title: 'Failed to Complete Veracode Policy Scan',
      summary: scanRunIntoErrorMessage
    }
    // const conclusion = veracodeScanConfigs[scanEventType].break_build_on_error ? 'failure' : 'success';
    await updateChecks(run, context, output, conclusion);
    return { "scanFailed": true };;
  }

  /* Step 5: If there is no defined error message in the retrieved log, return */
  return { "scanFailed": false };;
}

module.exports = {
  handleErrorInScan,
}