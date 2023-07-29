const fs = require('fs').promises;

async function getAutoBuildEvent(app, context, scanType) {
  const primaryLanguage = context.payload.repository.language;
  const owner = context.payload.repository.owner.login;
  const originalRepo = context.payload.repository.name;
  const octokit = context.octokit;
  // TODO: still need central control?
  // const veracodeJsonContent = await context.octokit.repos.getContent({
  //   owner: context.payload.repository.owner.login,
  //   repo: default_organization_repository,
  //   path: "veracode.json"
  // });

  // const base64String = veracodeJsonContent.data.content;
  // const decodedString = Buffer.from(base64String, 'base64').toString();
  // const veracode = JSON.parse(decodedString);

  // if (context.payload.repository.name in veracode) {
  //   return veracode[context.payload.repository.name].build_workflow;
  // }

  let foundByPrimary = false;
  let autoBuildEvent;

  try {
    autoBuildEvent = await getAutoBuildEventByLanguage(
      app,
      [primaryLanguage], 
      octokit,
      owner,
      originalRepo,
      scanType
    );
    foundByPrimary = true;
  } catch (error) {
    app.log.info(new Date().toString()+' - '+`Primary ${error.message}`);
  }

  // THE BELOW SECTION RETRIEVES ALL LANGUAGES DETECTED IN THE REPOSITORY
  // NOT TOO SURE IF WE NEED TO PACKAGE THE APPLICATION FOR ALL LANGUAGES DETECTED
  // OR JUST PACKAGE THE PRIMARY LANGUAGE
  if (!foundByPrimary) {
    try {
      const languages = await octokit.request(`GET /repos/${owner}/${originalRepo}/languages`);
      let sortedLanguages = [];
      for (const [key, value] of Object.entries(languages.data)) {
        sortedLanguages.push(key);
      }
      autoBuildEvent = await getAutoBuildEventByLanguage(
        app,
        sortedLanguages, 
        octokit,
        owner,
        originalRepo,
        scanType
      );
    } catch (error) {
      app.log.info(error.message);
      return await getAutoBuildEventByLanguage(
        app,
        ['default'], 
        octokit,
        owner,
        originalRepo,
        scanType
      );
    }
  }
  app.log.info(new Date().toString()+' - '+`Auto Build Event: ${autoBuildEvent}`);
  return autoBuildEvent;
}

async function getAutoBuildEventByLanguage(app, languages, octokit, owner, originalRepo, scanType) {
  const buildInstructionPath = 'src/utils/build-instructions.json';
  const buildInstructions = JSON.parse(await fs.readFile(buildInstructionPath));

  console.log(new Date().toString()+' - '+`Languages: ${languages}`);

  for (idx in languages) {
    if (languages[idx] in buildInstructions)
      return await getCompilationWorkflowEvent(
        app,
        buildInstructions[languages[idx]], 
        octokit,
        owner,
        originalRepo,
        scanType
      );
  }
  throw new Error(new Date().toString()+' - Language and Framework not Enabled for Auto Compilation.');
}

async function getCompilationWorkflowEvent(app, buildInstructions, octokit, owner, originalRepo, scanType) {
  let countOfBuildInstructionsFound = 0;
  let buildInstructionFound;

  for (let item in buildInstructions) {
    const buildInstruction = buildInstructions[item];
    try {
      if (buildInstruction.build_tool !== 'NA')
        await octokit.repos.getContent({
          owner,
          repo: originalRepo,
          path: buildInstruction.build_tool
        });
      buildInstructionFound = buildInstruction;
      countOfBuildInstructionsFound++;
    } catch (error) {
      app.log.info(new Date().toString()+' - '+`build tool ${buildInstruction.build_tool} not found in the repository`)
    }
  }  
  if (countOfBuildInstructionsFound !== 1)
    throw new Error(new Date().toString()+' - Found More than one Compilation in the Repository'); 
  return buildInstructionFound.repository_dispatch_type[scanType];
} 

module.exports = {
  getAutoBuildEvent
}