import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [ContactsController],
    providers: [ContactsService],
    exports: [ContactsService]
})
export class ContactsModule { }