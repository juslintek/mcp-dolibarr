import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleProjectTool } from '../build/tools/crm_projects_hr.js';
import { DolibarrAPI } from '../build/api.js';

const calls = [];
const api = {
  get: async (...args) => { calls.push(['get', ...args]); return args[0].endsWith('/tasks') ? [{ id: 1 }, { id: 2 }] : {}; },
  post: async (...args) => { calls.push(['post', ...args]); return 3; },
};
await handleProjectTool('get_project', { id: 12 }, api);
assert.deepEqual(calls.splice(0), [['get', '/projects/12'], ['get', '/projects/12/tasks']]);
assert.deepEqual(JSON.parse(await handleProjectTool('list_tasks', { project_id: 12, limit: 1 }, api)), [{ id: 1 }]);
assert.deepEqual(calls.splice(0), [['get', '/projects/12/tasks']]);
await handleProjectTool('list_tasks', { limit: 2 }, api);
assert.deepEqual(calls.splice(0), [['get', '/tasks', { limit: 2 }]]);
await handleProjectTool('create_task', { project_id: 12, label: 'Test' }, api);
assert.equal(calls[0][1], '/tasks');
assert.equal(calls[0][2].ref, 'auto');
assert.equal(calls[0][2].fk_project, 12);
assert.equal(Object.hasOwn(calls[0][2], 'project_id'), false);
calls.length = 0;
await assert.rejects(handleProjectTool('list_tasks', { project_id: '../other' }, api));

let followed = false;
const destination = createServer((req, res) => { followed = true; res.end('{}'); });
await new Promise(resolve => destination.listen(0, '127.0.0.1', resolve));
const source = createServer((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${destination.address().port}/` }); res.end(); });
await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
try {
  const client = new DolibarrAPI(`http://127.0.0.1:${source.address().port}`, 'test-key');
  await assert.rejects(client.get('/projects'));
  assert.equal(followed, false);
} finally {
  source.close();
  destination.close();
}
