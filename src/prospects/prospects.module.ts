import { Module } from '@nestjs/common';
import { ProspectsService } from './prospects.service';
import { ProspectsController } from './prospects.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [ProspectsController],
    providers: [ProspectsService],
    exports: [ProspectsService]
})
export class ProspectsModule { }