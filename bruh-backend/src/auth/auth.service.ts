import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ethers } from 'ethers';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class AuthService {
    constructor(
        private jwt: JwtService,
        private supabase: SupabaseService,
    ) { }

    // Generate a nonce for the user to sign
    generateNonce(): string {
        return `Sign this message to login to Bruh.\nNonce: ${Math.random().toString(36).slice(2)}`;
    }

    // Verify signature and return JWT
    async verifySignature(address: string, signature: string, message: string): Promise<string> {
        // Normalize \n escape sequences to real newlines
        const normalizedMessage = message.replace(/\\n/g, '\n');

        const recovered = ethers.verifyMessage(normalizedMessage, signature);
        if (recovered.toLowerCase() !== address.toLowerCase()) {
            throw new Error('Invalid signature');
        }

        await this.supabase.db
            .from('users')
            .upsert({ user_address: address.toLowerCase() });

        return this.jwt.sign({ address: address.toLowerCase() });
    }
}