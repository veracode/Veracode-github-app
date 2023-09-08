const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const { updateChecks } = require('./checks');
const appConfig = require('../../app-config');

async function updateChecksForCompletedSastScan(run, context, scanConfig, veracodeScanConfigs = undefined) {
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;
  const conclusion = context.payload.workflow_run?.conclusion;

  const scanEventType = run.check_run_type.replaceAll(/-/g, '_');
  let conclusionIfFail = 'failure';
  let conclusionIfPolicyFail = 'failure';
  if (veracodeScanConfigs && scanEventType in veracodeScanConfigs) {
    conclusionIfFail = veracodeScanConfigs[scanEventType].break_build_on_error ? 'failure' : 'success';
    conclusionIfPolicyFail = veracodeScanConfigs[scanEventType].break_build_policy_findings ? 'failure' : 'success';
  }

  const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/artifacts`
  let artifactRequest = await context.octokit.request(url);

  let retry = 20;
  while (artifactRequest.data.total_count === 0 && retry > 0) {
    retry--;
    await sleep(5000);
    console.log(`Artifact not found, retrying. remaining retries: ${retry}`);
    artifactRequest = await context.octokit.request(url);
  }

  if (retry === 0 && artifactRequest.data.total_count === 0) {
    updateChecks(run, context, {
      annotations: [],
      title: scanConfig.title,
      summary: 'Failed to fetch results artifacts.'
    }, conclusionIfFail);
    return;
  }

  let annotations = []
  const artifacts = artifactRequest.data;
  let resultsUrl = '';

  for (const artifact of artifacts.artifacts) {
    if (artifact.name !== scanConfig.artifactName 
        && artifact.name !== scanConfig.errorArtifactName) {
      continue;
    }
    const timestamp = new Date().toISOString();
    const artifactName = `${run.repository_owner}-${run.repository_name}-${timestamp}`;
    const artifactFilename = `${appConfig().artifactFolder}/${artifactName}.zip`;
    const destination = `${appConfig().artifactFolder}/${artifactName}`;

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const artifactData = await context.octokit.request(`GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/artifacts/${artifact.id}/zip`);
    await fs.writeFileSync(artifactFilename, Buffer.from(artifactData.data));
    const zip = new AdmZip(artifactFilename);
    zip.extractAllTo(`${destination}`, /*overwrite*/true);

    if (artifact.name === scanConfig.errorArtifactName) {
      if (scanConfig.errorFileName !== null) {
        resultsUrl = fs.readFileSync(
          `${destination}/${scanConfig.errorFileName}`, 
          'utf8'
        );
      }
    } else {
      if (scanConfig.resultsUrlFileName !== null) {
        resultsUrl = fs.readFileSync(
          `${destination}/${scanConfig.resultsUrlFileName}`, 
          'utf8'
        );
      }
      if (scanConfig.findingFileName !== null) {
        const data = fs.readFileSync(`${destination}/${scanConfig.findingFileName}`)
        const json = JSON.parse(data);
        annotations = scanConfig.getAnnotations(json);
      }
    }
    
    fs.rm(destination, { recursive: true });
    fs.rm(artifactFilename);
  }

  if (annotations.length === 0) {
    const resultsTooLarge = resultsUrl.length > 60000;
    let truncatedResults = resultsTooLarge ? resultsUrl.substring(0, 60000) : resultsUrl;
    if (resultsTooLarge) {
      truncatedResults = 'The scan finished but the output is too big it dispaly here,' + 
       ` please check the artifact individually.\n\n${truncatedResults}`;
    }
    /* 
     * If the scan is a SAST policy scan, and the annotation is empty, it means the scan
     * finished successfully and no policy violation was found. In this case, we will
     * update the check run with a success conclusion.
     */
    if (run.check_run_type === 'veracode-sast-policy-scan') {
      updateChecks(run, context, {
        annotations: [],
        title: scanConfig.title,
        summary: `Here\'s the summary of the check result, the full report can be found [here](${resultsUrl}).`
      }, 'success');
      return;
    } else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-iac-secrets-scan') {
      /* If the scan is a SCA / IAC scan, and the workflow job returned successful, it means no policy violation */
      updateChecks(run, context, {
        annotations: [],
        title: scanConfig.title,
        summary: `<pre>${truncatedResults}</pre>`
      }, conclusion === 'success' ? 'success' : conclusionIfPolicyFail);
    }
    return;
  }

  const maxNumberOfAnnotations = 50;

  for (let index = 0; index < annotations.length / maxNumberOfAnnotations; index++) {
    const annotationBatch = annotations.slice(
      index * maxNumberOfAnnotations, 
      (index + 1) * maxNumberOfAnnotations
    );
    if (annotationBatch !== []) {
      const data = {
        owner: run.repository_owner,
        repo: run.repository_name,
        check_run_id: run.check_run_id,
        // name: `${check.name}`,
        status: context.payload.workflow_run?.status,
        conclusion: conclusion === 'success' ? 'success' : conclusionIfPolicyFail,
        output: {
          annotations: annotationBatch,
          title: 'Veracode Static Analysis',
          summary: resultsUrl === '' ? 
            'Here\'s the summary of the check result.' : 
            `Here\'s the summary of the check result, the full report can be found [here](${resultsUrl}).`
        }
      }

      await context.octokit.checks.update(data);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  updateChecksForCompletedSastScan,
}