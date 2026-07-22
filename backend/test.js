const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');
const STATE_FILE_TMP = path.join(__dirname, 'state.json.tmp');

async function cleanupState() {
  try {
    await fs.unlink(STATE_FILE);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  try {
    await fs.unlink(STATE_FILE_TMP);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function runTests() {
  console.log('Running tests...\n');

  await cleanupState();

  // Set test port before importing
  process.env.PORT = 3002;
  
  // Import after cleanup to load clean state
  const { app, ready } = require('./server');
  
  // Wait for state to load
  await ready;

  try {
    await testSelectId(app);
    await testPreventDuplicateSelection(app);
    await testDeselectId(app);
    await testAddCustomId(app);
    await testReorderPersistence(app);
    await testPagination(app);
    await testPaginationWithSearch(app);
    await testInvalidIdValidation(app);
    await testReorderPayloadSizeLimit(app);
    await testCustomIdConflict(app);

    console.log('\n✅ All tests passed');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await cleanupState();
    process.exit(0);
  }
}

async function testSelectId(app) {
  const res = await request(app)
    .post('/select')
    .send({ id: 1 });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (res.body.ok !== true) throw new Error('Expected ok: true');

  const stateRes = await request(app).get('/state');
  if (!stateRes.body.selected.includes(1)) throw new Error('ID 1 should be in selected');
  
  console.log('✓ Select ID');
}

async function testPreventDuplicateSelection(app) {
  await request(app).post('/select').send({ id: 2 });
  
  const res = await request(app)
    .post('/select')
    .send({ id: 2 });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  
  const stateRes = await request(app).get('/state');
  const count = stateRes.body.selected.filter(id => id === 2).length;
  if (count !== 1) throw new Error('ID should only appear once');
  
  console.log('✓ Prevent duplicate selection');
}

async function testDeselectId(app) {
  await request(app).post('/select').send({ id: 3 });
  
  const res = await request(app)
    .post('/deselect')
    .send({ id: 3 });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  
  const stateRes = await request(app).get('/state');
  if (stateRes.body.selected.includes(3)) throw new Error('ID 3 should be removed');
  
  console.log('✓ Deselect ID');
}

async function testAddCustomId(app) {
  const customId = 999999999;
  
  const res = await request(app)
    .post('/add')
    .send({ id: customId });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  
  // Search for specific term to find the custom ID
  const leftRes = await request(app).get('/left').query({ q: '999999' });
  if (!leftRes.body.includes(customId)) throw new Error('Custom ID should be available');
  
  console.log('✓ Add custom ID');
}

async function testReorderPersistence(app) {
  await request(app).post('/select').send({ id: 10 });
  await request(app).post('/select').send({ id: 20 });
  
  const res = await request(app)
    .post('/reorder')
    .send({ items: [20, 10] });

  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  
  const stateRes = await request(app).get('/state');
  const idx20 = stateRes.body.selected.indexOf(20);
  const idx10 = stateRes.body.selected.indexOf(10);
  if (idx20 >= idx10) throw new Error('Order should be [20, 10]');
  
  console.log('✓ Reorder persistence');
}

async function testPagination(app) {
  const res = await request(app)
    .get('/left')
    .query({ page: 0 });

  if (!Array.isArray(res.body)) throw new Error('Response should be array');
  if (res.body.length > 20) throw new Error('Should return max 20 items');
  
  const page1 = await request(app)
    .get('/left')
    .query({ page: 1 });
  
  if (page1.body[0] === res.body[0]) throw new Error('Pages should be different');
  
  console.log('✓ Pagination');
}

async function testPaginationWithSearch(app) {
  await request(app).post('/select').send({ id: 100 });
  await request(app).post('/select').send({ id: 200 });
  await request(app).post('/select').send({ id: 300 });
  
  const res = await request(app)
    .get('/right')
    .query({ q: '1', page: 0 });

  if (!res.body.every(id => String(id).includes('1'))) {
    throw new Error('All results should include search term');
  }
  
  console.log('✓ Pagination with search');
}

async function testInvalidIdValidation(app) {
  const res = await request(app)
    .post('/select')
    .send({ id: -1 });

  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!res.body.error) throw new Error('Should return error message');
  
  console.log('✓ Invalid ID validation');
}

async function testReorderPayloadSizeLimit(app) {
  const largeArray = Array(10001).fill(1);
  
  const res = await request(app)
    .post('/reorder')
    .send({ items: largeArray });

  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  
  console.log('✓ Reorder payload size limit');
}

async function testCustomIdConflict(app) {
  await request(app).post('/select').send({ id: 5000000 });
  
  const res = await request(app)
    .post('/add')
    .send({ id: 5000000 });

  if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  
  console.log('✓ Custom ID conflict detection');
}

runTests();
