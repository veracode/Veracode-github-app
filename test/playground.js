// const myString1 = 'feature/*';
// const myRegExp1 = new RegExp('^' + myString1.replace(/\*/g, '.*') + '$');

// console.log(myRegExp1); // Output: /^feature\/.*/

// console.log(myRegExp1.test('feature/123')); // Output: true


// const myString2 = 'main';
// const myRegExp2 = new RegExp('^' + myString2.replace(/\*/g, '.*') + '$');
// console.log(myRegExp2); // Output: /^feature\/.*/

// console.log(myRegExp2.test('main')); // Output: true


// const myString3 = '*';
// const myRegExp3 = new RegExp('^' + myString3.replace(/\*/g, '.*') + '$');
// console.log(myRegExp3); // Output: /^feature\/.*/

// console.log(myRegExp3.test('vincentdeng')); // Output: true


// const mystr4 = 'veracode_container_security_scan'
// console.log(mystr4.replaceAll(/_/g, '-'));

// const var1 = 'veracode-local-compilation-scan';

// console.log(var1.substring(0,26));

const scanType = 'veracode_container_security_scan';
const scanEventType = scanType.replaceAll(/-/g, '_');
console.log(scanEventType);


let dispatchEvents = [];
dispatchEvents.push({
  event_type: 'test',
  repository: 'default_organization_repository',
  event_trigger: 'test',
  modules_to_scan: undefined,
});

console.log(dispatchEvents);