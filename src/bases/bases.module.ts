import { Module } from '@nestjs/common';
import { BasesService } from './bases.service';
import { BasesController } from './bases.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [BasesController],
    providers: [BasesService],
})
export class BasesModule { }