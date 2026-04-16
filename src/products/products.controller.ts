import {
  Controller, Get, Post, Put, Body, Param, Req, UseGuards, ParseIntPipe, Patch
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    user: string;
  };
}

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get()
  getAll() {
    return this.productsService.getProducts();
  }

  @Post('create')
  create(
    @Body() data: CreateProductDto,
    @Req() req: RequestWithUser
  ) {
    return this.productsService.createProduct(data, req.user.userId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductDto,
    @Req() req: RequestWithUser
  ) {
    return this.productsService.updateProduct(id, data, req.user.userId);
  }

  @Put('updateStock/:id')
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductDto,
    @Req() req: RequestWithUser
  ) {
    return this.productsService.updateStock(id, data.stock!, req.user.userId);
  }

  @Patch(':id/status')
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser
  ) {
    return this.productsService.toggleStatus(id, req.user.userId);
  }
}