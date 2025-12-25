import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

const APP_NAME = 'SpeakUp';

interface TOTPSecretResult {
	secret: string;
	otpauthUrl: string;
}

// generate new TOTP
export function generateTOTPSecret(userEmail: string): TOTPSecretResult {
	const totp = new OTPAuth.TOTP({
		issuer: APP_NAME,
		label: userEmail,
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret: new OTPAuth.Secret({ size: 20 }),
	});

	return {
		secret: totp.secret.base32,
		otpauthUrl: totp.toString(),
	};
}

// verify TOTP
export function verifyTOTP(secret: string, code: string): boolean {
	try {
		const totp = new OTPAuth.TOTP({
			issuer: APP_NAME,
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
			secret: OTPAuth.Secret.fromBase32(secret),
		});

		// validate while allowing for clock drift
		const delta = totp.validate({ token: code, window: 1 });
		
		// if delta is null -> invalid
		return delta !== null;
	} catch (error) {
		console.error('TOTP verification error:', error);
		return false;
	}
}

// generate qrcode for totp
export async function generateQRCode(otpauthUrl: string): Promise<string> {
	try {
		// generate as img
		const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
			errorCorrectionLevel: 'M',
			type: 'image/png',
			margin: 2,
			width: 256,
			color: {
				dark: '#000000',
				light: '#ffffff',
			},
		});
		
		return qrCodeDataUrl;
	} catch (error) {
		console.error('QR code generation error:', error);
		throw new Error('Failed to generate QR code');
	}
}

// generate backup codes
export function generateBackupCodes(count: number = 10): string[] {
	const codes: string[] = [];
	
	for (let i = 0; i < count; i++) {
		// gen alphanum codes
		const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase();
		codes.push(code);
	}
	
	return codes;
}
