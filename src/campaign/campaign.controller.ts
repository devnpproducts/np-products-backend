import { Controller, Get, Post, Put, Patch, Body, Param, ParseIntPipe, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';

import { CampaignService } from './campaign.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

interface RequestWithUser extends Request {
    user: {
        userId: number;
        user: string;
    };
}

@Controller('campaign')
@UseGuards(AuthGuard('jwt'))
export class CampaignController {
    constructor(private readonly campaignService: CampaignService) { }

    @Post('create')
    create(@Body() createDto: CreateCampaignDto, @Req() req: RequestWithUser) {
        return this.campaignService.create(createDto, req.user.userId);
    }

    @Post(':id/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadProspects(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: RequestWithUser
    ) {
        return this.campaignService.processExcel(id, file, req.user.userId);
    }

    @Get()
    findAll(@Req() req: RequestWithUser) {
        return this.campaignService.findAll(req.user.userId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.campaignService.findOne(id);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateCampaignDto) {
        return this.campaignService.update(id, updateDto);
    }

    @Patch(':id/status')
    toggleStatus(@Param('id', ParseIntPipe) id: number) {
        return this.campaignService.toggleStatus(id);
    }

    @Patch(':id/assign-seller')
    async assignToSeller(
        @Param('id', ParseIntPipe) campaignId: number,
        @Body('sellerId', ParseIntPipe) sellerId: number
    ) {
        return this.campaignService.assignCampaignToSeller(campaignId, sellerId);
    }
}