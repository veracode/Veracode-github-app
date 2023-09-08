
async function getBranchByName(app, context, branchName) {
  const { data: branch } = await context.octokit.repos.getBranch({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    branch: branchName,
  });

  return branch;
}

module.exports = {
  getBranchByName,
}