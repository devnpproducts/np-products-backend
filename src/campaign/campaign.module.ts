import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { EventsModule } from '../common/events.module';

@Module({
    imports: [EventsModule],
    controllers: [CampaignController],
    providers: [CampaignService],
})
export class CampaignModule { }