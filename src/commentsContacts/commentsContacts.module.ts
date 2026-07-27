import { Module } from '@nestjs/common';
import { CommentsContactsService } from './commentsContacts.service';
import { CommentsContactsController } from './commentsContacts.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [CommentsContactsController],
    providers: [CommentsContactsService],
})
export class CommentsContactsModule { }