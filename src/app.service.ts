import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Service is live  😊' + process.env.PORT;
  }
}
