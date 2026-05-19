// sales.module.ts
import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [SalesController],
    providers: [SalesService],
    exports: [SalesService]
})
export class SalesModule { }