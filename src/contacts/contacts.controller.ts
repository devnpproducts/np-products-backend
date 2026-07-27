// contacts.controller.ts
import { Controller, Get, Post, Body, Put, Param, Req, UseGuards, ParseIntPipe, Query, Patch } from '@nestjs/common';
import { ContactsService } from './contacts.service';    
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('contacts')
@UseGuards(AuthGuard('jwt'))
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() dto: CreateContactDto, @Req() req: RequestWithUser) {
    return this.contactsService.create(dto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('type') type: 'all' | 'sale' = 'all',
    @Req() req: RequestWithUser
  ) {
    return this.contactsService.findAll(type, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.contactsService.findOne(id, req.user.userId);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContactDto, @Req() req: RequestWithUser) {
    return this.contactsService.update(id, dto, req.user.userId);
  }

  @Patch(':id/sale')
  markSale(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.contactsService.markAsSale(id, req.user.userId);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.getHistory(id);
  }
}