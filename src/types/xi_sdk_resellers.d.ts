// src/types/xi_sdk_resellers.d.ts
declare module 'xi_sdk_resellers' {
  export class AccesstokenApi {
    getAccesstoken(
      grantType: string,
      clientId: string,
      clientSecret: string,
      callback: (error: any, data: any, response: any) => void,
    ): void;
  }
}
