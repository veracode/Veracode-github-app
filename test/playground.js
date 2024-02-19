const eventName = 'issue_comment';
const eventNameMatchingConfig = eventName.replaceAll(/issues?(_comment)?/g, 'issue');
console.log(eventNameMatchingConfig);
