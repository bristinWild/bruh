import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private auth: AuthService) { }

    @Get('nonce')
    nonce() {
        return { message: this.auth.generateNonce() };
    }

    @Post('verify')
    async verify(@Body() body: { address: string; signature: string; message: string }) {
        const token = await this.auth.verifySignature(
            body.address,
            body.signature,
            body.message
        );
        return { token };
    }
}