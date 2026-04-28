import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RegisterSalesService } from './register-sales.service';
import { CreateRegisterSaleDto } from './dto/register-sales.dto';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    user: string;
  };
}

@Controller('sales')
@UseGuards(AuthGuard('jwt'))
export class RegisterSalesController {
  constructor(private readonly salesService: RegisterSalesService) { }

  @Get()
  async getMySales(@Req() req: RequestWithUser) {
    // req.user viene de tu Passport/JWT Guard
    return this.salesService.findAll(req.user.userId);
  }

  @Get('search')
  async search(@Query('term') term: string) {
    if (!term) return { sales: [], prospects: [] };

    return this.salesService.searchGlobal(term);
  }

  @Post()
  create(@Body() createDto: CreateRegisterSaleDto, req: RequestWithUser) {
    return this.salesService.convertToSale(createDto, req.user.userId);
  }
}