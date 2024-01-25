const createDispatchEvent = async function (event, dispatchEventData) {
  context = dispatchEventData.context;
  await context.octokit.repos.createDispatchEvent({
    owner: context.payload.repository.owner.login,
    repo: event.repository,
    event_type: event.event_trigger,
    client_payload: {
      ...dispatchEventData.payload,
      event: context.payload,
      event_type: event.event_type,
      modules_to_scan: event.modules_to_scan ?? '',
      fail_checks: {
        fail_checks_on_policy: event.fail_checks_on_policy ?? false,
        fail_checks_on_error: event.fail_checks_on_error ?? false,
      }
    }
  });
}

module.exports = {
  createDispatchEvent,
}