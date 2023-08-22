const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const appConfig = require('../../app-config');

async function getWorkflowRunArtifact(context, artifactName, artifactFileName) {
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;

  const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/artifacts`;
  const artifact = await retryFetchingArtifact(context, url, artifactName);
  
  if (!artifact) {
    console.log("Artifact not found after retries.");
    return null;
  }

  const timestamp = new Date().toISOString();
  const tmpArtifactFile = `${appConfig().artifactFolder}/${workflow_reopo_owner}-${workflow_repo_name}-${timestamp}.zip`;
  const destination = `${appConfig().artifactFolder}/${workflow_reopo_owner}-${workflow_repo_name}-${timestamp}`;

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const artifactData = await context.octokit.request(`GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/artifacts/${artifact.id}/zip`);
  await fs.writeFileSync(tmpArtifactFile, Buffer.from(artifactData.data));
  const zip = new AdmZip(tmpArtifactFile);
  zip.extractAllTo(`${destination}`, /*overwrite*/true);

  let responseData = null;

  if(artifactFileName.endsWith('.json')) {
    const data = fs.readFileSync(`${destination}/${artifactFileName}`)
    responseData = JSON.parse(data);
  } else {
    responseData = fs.readFileSync(`${destination}/${artifactFileName}`, 'utf8');
  }

  fs.rm(destination, { recursive: true });
  fs.rm(tmpArtifactFile);

  return responseData;
}

async function retryFetchingArtifact(context, url, artifactName, maxRetries = 20, retryInterval = 5000) {
  for (let retry = maxRetries; retry > 0; retry--) {
    const artifact = await getArtifactByName(context, url, artifactName);
    if (artifact) {
      console.log(`Found artifact: ${artifact.name}`);
      return artifact;
    }
    console.log(`Artifact not found, retrying. Remaining retries: ${retry}`);
    await sleep(retryInterval);
  }
  return null;
}

async function getArtifactByName(context, url, artifactName) {
  try {
    const response = await context.octokit.request(url);

    const artifacts = response.data.artifacts;
    const matchingArtifact = artifacts.find(artifact => artifact.name === artifactName);

    return matchingArtifact || null;
  } catch (error) {
    console.error('Error retrieving artifacts:', error);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports  = {
  getWorkflowRunArtifact,
}