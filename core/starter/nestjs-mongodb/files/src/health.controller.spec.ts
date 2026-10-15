import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('answers ok', () => {
    expect(new HealthController().health()).toEqual({ status: 'ok' });
  });
});
