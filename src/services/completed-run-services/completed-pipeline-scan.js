const { updateChecksForCompletedSastScan } = 
  require('../check-services/update-checks-with-artifact');

async function updateChecksForCompletedPipelineScan (run, context) {
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
        const message = `Filename: ${element.files.source_file.file}\nLine: ${element.files.source_file.line}\nCWE: ${element.cwe_id} (${element.issue_type})\n\n${displayMessage}
        `;
        annotations.push({
          // TODO: get rid of src/main/java
          path: `src/main/java/${element.files.source_file.file}`,
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
  await updateChecksForCompletedSastScan(run, context, pipelineScanConfig);
}

module.exports = {
  updateChecksForCompletedPipelineScan,
}