const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

// Set NODE_ENV to test to prevent server listening
process.env.NODE_ENV = 'test';

test.describe('AnonyMots Backend API Tests', () => {
  const testUsername = 'test_user_for_ci';

  test.beforeEach((t, done) => {
    // Nettoyer la base de données avant chaque test pour s'assurer de l'indépendance des tests
    db.serialize(() => {
      db.run("DELETE FROM messages WHERE recipient_username = ?", [testUsername], () => {
        db.run("DELETE FROM users WHERE username = ?", [testUsername], () => {
          done();
        });
      });
    });
  });

  test.after((t, done) => {
    // Nettoyage final après tous les tests
    db.serialize(() => {
      db.run("DELETE FROM messages WHERE recipient_username = ?", [testUsername], () => {
        db.run("DELETE FROM users WHERE username = ?", [testUsername], () => {
          done();
        });
      });
    });
  });

  test('GET /api/health - Health check status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    assert.strictEqual(res.body.status, 'OK');
    assert.match(res.body.message, /AnonyMots API is running/);
  });

  test('POST /api/users - Create a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect('Content-Type', /json/)
      .expect(201);

    assert.strictEqual(res.body.username, testUsername);
    assert.ok(res.body.id);
    assert.ok(res.body.link);
  });

  test('POST /api/users - Return conflict on duplicate user', async () => {
    // Create first
    await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(201);

    // Try creating duplicate
    const res = await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(409);

    assert.strictEqual(res.body.error, "Ce nom d'utilisateur existe déjà");
  });

  test('GET /api/users/:username - Retrieve existing user', async () => {
    await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(201);

    const res = await request(app)
      .get(`/api/users/${testUsername}`)
      .expect(200);

    assert.strictEqual(res.body.username, testUsername);
  });

  test('GET /api/users/:username - Return 404 for non-existent user', async () => {
    await request(app)
      .get('/api/users/non_existent_user_xyz')
      .expect(404);
  });

  test('POST /api/messages & GET /api/messages/:username - Send and retrieve anonymous messages', async () => {
    // Create recipient first
    await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(201);

    // Send a message
    const msgRes = await request(app)
      .post('/api/messages')
      .send({
        recipient: testUsername,
        content: 'Hello, this is a test message!',
        hasClue: false
      })
      .expect(201);

    assert.strictEqual(msgRes.body.message, 'Message envoyé avec succès');

    // Retrieve messages
    const getRes = await request(app)
      .get(`/api/messages/${testUsername}`)
      .expect(200);

    assert.ok(Array.isArray(getRes.body));
    assert.strictEqual(getRes.body.length, 1);
    assert.strictEqual(getRes.body[0].content, 'Hello, this is a test message!');
    assert.strictEqual(getRes.body[0].has_clue, 0); // SQLite stores boolean as 0/1
  });

  test('Moderation - Block isolated bad words but allow words containing them (Scunthorpe problem)', async () => {
    // Create recipient
    await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(201);

    // 1. Envoi d'un message bienveillant contenant un mot interdit en sous-partie (ex: "annuler" contient "nul", "update" contient "pd")
    await request(app)
      .post('/api/messages')
      .send({
        recipient: testUsername,
        content: 'Je vais annuler ma réunion pour faire un update.',
        hasClue: false
      })
      .expect(201);

    // 2. Envoi d'un message malveillant avec un mot interdit isolé (ex: "nul")
    await request(app)
      .post('/api/messages')
      .send({
        recipient: testUsername,
        content: 'Tu es nul !',
        hasClue: false
      })
      .expect(201); // La modération est silencieuse, renvoie quand même 201

    // Récupération des messages
    const getRes = await request(app)
      .get(`/api/messages/${testUsername}`)
      .expect(200);

    // Seul le message bienveillant doit être retourné (is_blocked = 0)
    // Le message malveillant doit être masqué (is_blocked = 1)
    assert.strictEqual(getRes.body.length, 1);
    assert.strictEqual(getRes.body[0].content, 'Je vais annuler ma réunion pour faire un update.');
  });

  test('PUT /api/messages/:id/guess - Gaming mode guess sender', async () => {
    // Create recipient
    await request(app)
      .post('/api/users')
      .send({ username: testUsername })
      .expect(201);

    // Send gaming message
    await request(app)
      .post('/api/messages')
      .send({
        recipient: testUsername,
        content: 'Devine qui je suis !',
        hasClue: true,
        clue: 'Je porte des lunettes',
        senderName: 'Martin'
      })
      .expect(201);

    // Retrieve message to get ID
    const getRes = await request(app)
      .get(`/api/messages/${testUsername}`)
      .expect(200);

    const messageId = getRes.body[0].id;

    // Guess wrong first
    const wrongRes = await request(app)
      .put(`/api/messages/${messageId}/guess`)
      .send({ guess: 'Lucas' })
      .expect(200);

    assert.strictEqual(wrongRes.body.success, false);

    // Guess right
    const rightRes = await request(app)
      .put(`/api/messages/${messageId}/guess`)
      .send({ guess: 'martin' }) // case insensitive trim check
      .expect(200);

    assert.strictEqual(rightRes.body.success, true);
    assert.strictEqual(rightRes.body.points, 10);
    assert.strictEqual(rightRes.body.senderName, 'martin');
  });

  test('GET /api/wellness-messages - Fetch wellness messages', async () => {
    const res = await request(app)
      .get('/api/wellness-messages')
      .expect(200);

    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length <= 5);
  });

  test('POST /api/quiz - Submit quiz and get message', async () => {
    const res = await request(app)
      .post('/api/quiz')
      .send({ mood: 'triste', needs: 'encouragement' })
      .expect(200);

    assert.strictEqual(res.body.mood_type, 'triste');
    assert.ok(res.body.personalized_message);
  });
});
