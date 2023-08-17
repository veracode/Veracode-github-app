const { getAutoBuildEventByLanguage } = require('../dispatch-event-services/get-auto-build-event');

async function isJavaMavenRepo(app, context, run, sastType) {
  let autoBuildEvent = null;
  try {
    const languages = await context.octokit.request(`GET /repos/${run.repository_owner}/${run.repository_name}/languages`);
    let sortedLanguages = [];
    for (const [key, value] of Object.entries(languages.data)) {
      sortedLanguages.push(key);
    }
    autoBuildEvent = await getAutoBuildEventByLanguage(
      app,
      sortedLanguages, 
      context.octokit,
      run.repository_owner,
      run.repository_name
    );
  } catch (error) {
    app.log.info(error.message);
    autoBuildEvent = await getAutoBuildEventByLanguage(
      app,
      ['default'], 
      context.octokit,
      run.repository_owner,
      run.repository_name
    );
  }
  if (sastType in autoBuildEvent.repository_dispatch_type && 
    autoBuildEvent.repository_dispatch_type[sastType].includes('java-maven')) return true;
  else return false;
}

module.exports = {
  isJavaMavenRepo,
}