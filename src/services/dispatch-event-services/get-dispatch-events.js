const fs = require('fs');
const yaml = require('js-yaml');
const { default_organization_repository } = require('../../utils/constants');
const { getAutoBuildEvent } = require('./get-auto-build-event');
const { shouldRunScanType } = require('../config-services/should-run');

async function getDispatchEvents(app, context, branch, veracodeScanConfigs) {
  const originalRepo = context.payload.repository.name;
  const eventName = context.name;
  const defaultBranch = context.payload.repository.default_branch;
  const action = context.payload.action ?? 'null';
  const targetBranch = context.payload.pull_request?.base?.ref ?? null;

  let dispatchEvents = [];
  const veracodeConfigKeys = Object.keys(veracodeScanConfigs);

  for (const scanType of veracodeConfigKeys) {
    if (!await shouldRunScanType(eventName, branch, defaultBranch, veracodeScanConfigs[scanType], action, targetBranch))
      continue;
    const scanEventType = scanType.replaceAll(/_/g, '-');
    
    // for sast scan, if compile_locally is true, dispatch to local compilation workflow
    // otherwise, dispatch to default organization repository with auto build
    // for non sast scan, simply dispatch to default organization repository
    if (scanType.includes('sast')) {
      if (veracodeScanConfigs[scanType].compile_locally) {
        dispatchEvents.push({
          event_type: `veracode-local-compilation-${scanEventType}`,
          repository: originalRepo,
          event_trigger: veracodeScanConfigs[scanType].local_compilation_workflow,
        });
      } else {
        const buildInstruction = await getAutoBuildEvent(app, context, scanType);
        dispatchEvents.push({
          event_type: scanEventType,
          repository: default_organization_repository,
          event_trigger: buildInstruction.repository_dispatch_type[scanType],
          modules_to_scan: veracodeScanConfigs[scanType].modules_to_scan,
        });
      }
    } else if(scanType.includes('sca')) {
      const buildInstruction = await getAutoBuildEvent(app, context, scanType);
      if (buildInstruction.veracode_sca_scan === 'true')
        dispatchEvents.push({
          event_type: scanEventType,
          repository: default_organization_repository,
          event_trigger: scanEventType,
        });
    } else {
      dispatchEvents.push({
        event_type: scanEventType,
        repository: default_organization_repository,
        event_trigger: scanEventType,
      });
    }
  }
  app.log.info(dispatchEvents);
  return dispatchEvents;
}

module.exports = {
  getDispatchEvents,
}