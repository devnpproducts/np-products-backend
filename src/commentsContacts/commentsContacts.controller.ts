import { Controller, Get, Post, Body, Param, Patch, Delete, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CommentsContactsService } from './commentsContacts.service';
import { CreateCommentContactsDto, UpdateCommentContactsDto } from './dto/commentsContacts.dto';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('commentsContacts')
@UseGuards(AuthGuard('jwt'))
export class CommentsContactsController {
  constructor(private readonly commentsContactService: CommentsContactsService) { }

  @Post()
  create(@Body() dto: CreateCommentContactsDto, @Req() req: any) {
    return this.commentsContactService.create(
      dto.ContactId,
      dto.comment,
      req.user.userId
    );
  }

  @Get('contacts/:id')
  findAllByProspect(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.commentsContactService.findAllByContact(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentContactsDto
  ) {
    return this.commentsContactService.update(id, updateCommentDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentsContactService.remove(id);
  }
}