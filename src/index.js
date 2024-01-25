const { handleRegister } = require('./handlers/register');
const { handleCompletedRun } = require('./handlers/completed-run');
const { handleEvents } = require('./handlers/handler');
const handleInstallationRepositories = require('./handlers/installation');
const { handleRegisterWorkflow } = require('./handlers/register-workflow');
const { handleIssueEvents } = require('./handlers/issue-handler');

module.exports = async (app, { getRouter }) => {
  app.on(
    ["push", "pull_request"], 
    handleEvents.bind(null, app)
  );

  // No longer in Use
  // app.on(
  //   'workflow_run.in_progress', 
  //   handleRegisterWorkflow.bind(null, app)
  // );

  app.on(
    'workflow_run.completed', 
    handleCompletedRun.bind(null, app)
  );

  // app.on([
  //   "installation",
  //   "installation_repositories"
  //   ], 
  //   handleInstallationRepositories.bind(null, app)
  // );
  
  // app.on("check_run.rerequested", handleReRun);
  // app.on('pull_request.opened', async (context) => {
  //   console.log(context);
  // });
  app.on(
    ['issues.opened', 'issues.edited', 'issue_comment.created', 'issue_comment.edited'], 
    handleIssueEvents.bind(null, app)
  );

  const router = getRouter('');
  router.get('/register', (req, res) => {
    handleRegister(req, res, { app });
  });

  router.get('/health-check', (req, res) => {
    return res.status(200).send('Hello World');
  });
};
