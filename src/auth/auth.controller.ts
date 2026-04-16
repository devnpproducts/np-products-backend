import { Controller, Post, Body, UseGuards, Get, Req, Ip, Headers } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) { }

  @Post("login")
  async login(
    @Body() body: { user: string; password: string },
    @Ip() ip: string,
    @Headers('user-agent') device: string,)
  {
    return this.authService.login(body.user, body.password, ip, device);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get("me")
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findByUser(req.user.user);
    return { user };
  }
}