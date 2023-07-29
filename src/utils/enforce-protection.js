async function enforceProtection (octokit, repository, context_name, enforce, enforce_admin) {

  const repo = await octokit.repos.get({
    ...repository,
    mediaType: {
      previews: ['symmetra']
    }
  })

  let protection;

  try {
    protection = await octokit.repos.getBranchProtection({
      ...repository,
      branch: repo.data.default_branch
    })
  } catch (e) {
    console.error(new Date().toString()+' - '+e)
  }

  // console.log(protection);
  
}

module.exports = {
  enforceProtection,
}