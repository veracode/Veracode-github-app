const { updateChecksForCompletedSastScan } = 
  require('../check-services/update-checks-with-artifact');
const { isJavaMavenRepo } = require('./is-java-maven-repo');

async function updateChecksForCompletedPolicyScan (app, run, context, veracodeScanConfigs) {
  const javaMaven = isJavaMavenRepo(app, context, run, 'veracode_sast_policy_scan');
  const filePathPrefix = javaMaven ? 'src/main/java/' : '';

  const policyScanConfig = {
    artifactName: 'policy-flaws',
    findingFileName: 'policy_flaws.json',
    resultsUrlFileName: 'results_url.txt',
    errorArtifactName: 'veracode-error',
    errorFileName: 'error.txt',
    title: 'Veracode Static Analysis',
    getAnnotations: function(json) {
      let annotations = []
      json._embedded.findings.forEach(finding => {
        const displayMessage = finding.description.replace(/\<span\>/g, '').replace(/\<\/span\> /g, '\n').replace(/\<\/span\>/g, '');
        const message = `Filename: ${filePathPrefix}${finding.finding_details.file_path}\nLine: ${finding.finding_details.file_line_number}\nCWE: ${finding.finding_details.cwe.id} (${finding.finding_details.cwe.name})\n\n${displayMessage}`;
        annotations.push({
          path: `${filePathPrefix}${finding.finding_details.file_path}`,
          start_line: finding.finding_details.file_line_number,
          end_line: finding.finding_details.file_line_number,
          annotation_level: "warning",
          title: finding.finding_details.cwe.name, 
          'message': message
        });
      });
      return annotations;
    }
  }
  await updateChecksForCompletedSastScan(run, context, policyScanConfig, veracodeScanConfigs);
}

module.exports = {
  updateChecksForCompletedPolicyScan,
}