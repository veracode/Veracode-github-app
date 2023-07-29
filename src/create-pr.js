module.exports = createPR;

/**
 * creates a pr and uploads a file
 * Used primarily in installations
 *
 * @param {import('probot').Probot} app
 * @param Object fields
 */
async function createPR(context, fields) {
  const branch = `add-veracode-config` // your branch's name
  const content = Buffer.from(fields.file.content).toString('base64') // content for your configuration file
  const log = context.log;

  log.info(new Date().toString()+' - get default branch')
  
  const api = context.octokit;

  log.trace(new Date().toString()+' - api client: ' + api)

  try{
    const { data: repo } = await api.rest.repos.get(context.repo());
    
    const default_branch = repo.default_branch;
    
    log.trace(new Date().toString()+' - default branch is: ' + default_branch);

    const ref = `heads/${ default_branch }`;

    log.info(new Date().toString()+' - looking for: '+ ref)
    const accountLogin = context.payload.installation.account.login;

    context.repo = (val) => ({ owner: accountLogin, repo: repo.name, ...val });

    const { data: reference } = await api.rest.git.getRef(context.repo({
      ref: `heads/${ default_branch }`
    })); // get the reference for the master branch

    log.debug(new Date().toString()+' - got ref: ' + reference)
    const getBranch = await api.git.createRef(context.repo({
      ref: `refs/heads/${ branch }`,
      sha: reference.object.sha
    })) // create a reference in git for your branch

    log.debug('created ref')
    const file = await api.repos.createOrUpdateFileContents(context.repo({
      path: fields.file.path, // the path to your config file
      message: fields.file.commit_format, // a commit message
      content,
      branch
    })) // create your config file
    
    log.info(new Date().toString()+' - uploaded content successfully')
    log.info(new Date().toString()+' - Creating PR')
    log.debug(new Date().toString()+' - now create the pr')
    const { data: pull_request } =  await api.rest.pulls.create(context.repo({
      title: fields.pr.title, // the title of the PR
      head: branch,
      base: default_branch, // where you want to merge your changes
      body: fields.pr.body, // the body of your PR,
      maintainer_can_modify: true // allows maintainers to edit your app's PR
    }))
    log.info(new Date().toString()+' - PR created successfully')
  } catch(err){
    if(err.status === 404){
      log.info(new Date().toString()+" - unable to find repo - possibly inactive/archive now")
      return;
    }
    if(err.status === 422 && err.response.data.message === 'Reference already exists'){
      log.info(new Date().toString()+" - wont create config PR as branch already exists")
      return;
    }
    log.error(new Date().toString()+' - '+err)
    return;
  }
  return;
}