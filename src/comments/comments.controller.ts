import { Controller, Get, Post, Body, Param, Patch, Delete, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@Controller('comments')
@UseGuards(AuthGuard('jwt'))
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) { }

  @Post()
  create(@Body() dto: CreateCommentDto, @Req() req: RequestWithUser) {
    return this.commentsService.create(
      dto.prospectsId,
      dto.comment,
      req.user.userId
    );
  }

  @Get('prospect/:id')
  findAllByProspect(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.commentsService.findAllByProspect(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto
  ) {
    return this.commentsService.update(id, updateCommentDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.remove(id);
  }
}