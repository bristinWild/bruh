import {
    Injectable,
} from "@nestjs/common";

@Injectable()
export class AutonomyLockService {
    private locked = false;

    tryAcquire(): boolean {
        if (this.locked) {
            return false;
        }

        this.locked = true;
        return true;
    }

    release(): void {
        this.locked = false;
    }
}