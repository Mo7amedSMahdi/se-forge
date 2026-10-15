import { Controller, Get } from '@nestjs/common';

/** Liveness: the process answers. Compose and later the deployment wait for it. */
@Controller('health')
export class HealthController {
  @Get()
  health(): { status: string } {
    return { status: 'ok' };
  }
}
