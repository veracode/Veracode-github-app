const { updateChecksForCompletedSastScan } = 
  require('../check-services/update-checks-with-artifact');
const { isJavaMavenRepo } = require('./is-java-maven-repo');

async function updateChecksForCompletedPipelineScan (app, run, context, veracodeScanConfigs) {
  const javaMaven = await isJavaMavenRepo(app, context, run, 'veracode_sast_pipeline_scan');
  const filePathPrefix = javaMaven ? 'src/main/java/' : '';

  const pipelineScanConfig = {
    artifactName: 'Veracode Pipeline-Scan Results',
    findingFileName: 'filtered_results.json',
    resultsUrlFileName: null,
    errorArtifactName: 'veracode-error',
    errorFileName: 'error.txt',
    title: 'Veracode Static Analysis',
    getAnnotations: function(json) {
      let annotations = []
      json.findings.forEach(function(element) {
        const displayMessage = element.display_text.replace(/\<span\>/g, '').replace(/\<\/span\> /g, '\n').replace(/\<\/span\>/g, '');
        const message = `Filename: ${filePathPrefix}${element.files.source_file.file}\nLine: ${element.files.source_file.line}\nCWE: ${element.cwe_id} (${element.issue_type})\n\n${displayMessage}
        `;
        annotations.push({
          path: `${filePathPrefix}${element.files.source_file.file}`,
          start_line: element.files.source_file.line,
          end_line: element.files.source_file.line,
          annotation_level: "warning",
          title: element.issue_type,
          message: message,
        });
      })
      return annotations;
    }
  }
  await updateChecksForCompletedSastScan(run, context, pipelineScanConfig, veracodeScanConfigs);
}

module.exports = {
  updateChecksForCompletedPipelineScan,
}