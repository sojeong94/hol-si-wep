import { registerPlugin } from '@capacitor/core'

export interface AppleSignInResponse {
  response: {
    identityToken: string
    user: string
    email: string
    givenName: string
    familyName: string
  }
}

export interface AppleSignInPlugin {
  authorize(): Promise<AppleSignInResponse>
}

const AppleSignIn = registerPlugin<AppleSignInPlugin>('AppleSignIn')
export default AppleSignIn
