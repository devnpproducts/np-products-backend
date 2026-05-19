import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [ClientsController],
    providers: [ClientsService],
})
export class ClientsModule { }