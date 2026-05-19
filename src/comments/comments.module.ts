import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [CommentsController],
    providers: [CommentsService],
})
export class CommentsModule { }