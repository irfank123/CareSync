import express from 'express';
import request from 'supertest';
import healthRoutes from '@src/routes/health.mjs';

describe('Health Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    // Mount the actual health routes
    app.use(healthRoutes);
  });

  describe('GET /health', () => {
    test('should return 200 and correct message', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('message', 'Backend is connected and running!');
    });
  });
}); 