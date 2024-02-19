const { getAutoBuildEvent } = require('./get-auto-build-event');
const { shouldRunScanType, shouldRunScanTypeForIssue } = require('../config-services/should-run');
const appConfig = require('../../app-config');

async function getDispatchEvents(app, context, branch, veracodeScanConfigs, issueAttributesToCheck = undefined) {
  const originalRepo = context.payload.repository.name;
  const eventName = context.name;
  const defaultBranch = context.payload.repository.default_branch;
  const action = context.payload.action ?? 'null';
  const targetBranch = context.payload.pull_request?.base?.ref ?? null;

  let dispatchEvents = [];
  const veracodeConfigKeys = Object.keys(veracodeScanConfigs);

  for (const scanType of veracodeConfigKeys) {
    if (eventName === 'issues' || eventName === 'issue_comment') {
      if (!await shouldRunScanTypeForIssue(veracodeScanConfigs[scanType], issueAttributesToCheck))
        continue;
    } else {
      if (!await shouldRunScanType(eventName, branch, defaultBranch, veracodeScanConfigs[scanType], action, targetBranch))
        continue;
    }
    const scanEventType = scanType.replaceAll(/_/g, '-');
    
    // for sast scan, if compile_locally is true, dispatch to local compilation workflow
    // otherwise, dispatch to default organization repository with auto build
    // for non sast scan, simply dispatch to default organization repository
    if (scanEventType.includes('sast')) {
      if (veracodeScanConfigs[scanType].compile_locally) {
        dispatchEvents.push({
          event_type: `veracode-local-compilation-${scanEventType}`,
          repository: originalRepo,
          event_trigger: veracodeScanConfigs[scanType].local_compilation_workflow,
          fail_checks_on_policy: veracodeScanConfigs[scanType].break_build_policy_findings,
          fail_checks_on_error: veracodeScanConfigs[scanType].break_build_on_error,
        });
      } else {
        const buildInstruction = await getAutoBuildEvent(app, context, scanType);
        const eventTrigger = buildInstruction.repository_dispatch_type[scanType];
        dispatchEvents.push({
          event_type: eventTrigger === 'veracode-not-supported' ? eventTrigger : scanEventType,
          repository: appConfig().defaultOrganisationRepository,
          event_trigger: eventTrigger,
          modules_to_scan: veracodeScanConfigs[scanType].modules_to_scan,
          fail_checks_on_policy: veracodeScanConfigs[scanType].break_build_policy_findings,
          fail_checks_on_error: veracodeScanConfigs[scanType].break_build_on_error,
        });
        const eventNameMatchingConfig = eventName.replaceAll(/issues?(_comment)?/g, 'issue');
        if (veracodeScanConfigs[scanType][eventNameMatchingConfig]?.run_sandbox_scan_in_parallel && 
            eventTrigger !== 'veracode-not-supported') {
          dispatchEvents.push({
            event_type: 'veracode-sast-sandbox-scan',
            repository: appConfig().defaultOrganisationRepository,
            event_trigger: eventTrigger.replaceAll('pipeline', 'sandbox'),
            fail_checks_on_policy: veracodeScanConfigs[scanType].break_build_policy_findings,
            fail_checks_on_error: veracodeScanConfigs[scanType].break_build_on_error,
          });
        }
      }
    } else if(scanEventType.includes('sca-scan')) {
      const buildInstruction = await getAutoBuildEvent(app, context, scanType);
      if (buildInstruction.veracode_sca_scan === 'true')
        dispatchEvents.push({
          event_type: scanEventType,
          repository: appConfig().defaultOrganisationRepository,
          event_trigger: scanEventType,
          fail_checks_on_policy: veracodeScanConfigs[scanType].break_build_policy_findings,
          fail_checks_on_error: veracodeScanConfigs[scanType].break_build_on_error,
        });
    } else {
      dispatchEvents.push({
        event_type: scanEventType,
        repository: appConfig().defaultOrganisationRepository,
        event_trigger: scanEventType,
        fail_checks_on_policy: veracodeScanConfigs[scanType].break_build_policy_findings,
        fail_checks_on_error: veracodeScanConfigs[scanType].break_build_on_error,
      });
    }
  }
  app.log.info(dispatchEvents);
  return dispatchEvents;
}

module.exports = {
  getDispatchEvents,
}