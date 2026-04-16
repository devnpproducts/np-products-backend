import { Module } from '@nestjs/common';
import { EventsGateway } from './gateways';

@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}