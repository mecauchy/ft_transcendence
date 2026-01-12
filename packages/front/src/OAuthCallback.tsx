import {useEffect, useState} from 'react';
import {api} from './api/client';

function OAuthCallback() {
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const handleCallback = async () => {
			try {
				// Get token from URL query parameter
				const params = new URLSearchParams(window.location.search);
				
				// try decode
				const encodedData = params.get('data');
				let accessToken: string | null = null;
				let refreshToken: string | null = null;
				let require2FA = false;
				let userId: string | null = null;

				console.log('[OAuthCallback] Encoded data:', encodedData ? 'present' : 'missing');

				if (encodedData) {
					try {
						const decoded = JSON.parse(atob(encodedData));
						accessToken = decoded.accessToken;
						refreshToken = decoded.refreshToken;
						require2FA = decoded.require2FA || false;
						userId = decoded.userId || null;
						console.log('[OAuthCallback] Decoded:', { 
							hasAccessToken: !!accessToken, 
							hasRefreshToken: !!refreshToken, 
							require2FA, 
							userId 
						});
					} catch (decodeError) {
						console.error('[OAuthCallback] Decode failed:', decodeError);
						// else try without decode
						accessToken = params.get('token');
					}
				} else {
					// fallback to old format for backward compatibility
					accessToken = params.get('token');
					console.log('[OAuthCallback] Using fallback token:', !!accessToken);
				}

				if (!accessToken) {
					setError('No token received from OAuth provider');
					return;
				}

				// check 2fa requirement
				if (require2FA && userId) {
					console.log('[OAuthCallback] 2FA required, setting up for 2FA flow');
					// store userid to trigger modal
					localStorage.setItem('pending2FAUserId', userId);
					// store tokens temporarily
					localStorage.setItem('accessToken', accessToken);
					if (refreshToken) {
						localStorage.setItem('refreshToken', refreshToken);
					}
					// redirect to home with 2FA flag
					window.location.href = '/?require2fa=true';
					return;
				}

				console.log('[OAuthCallback] No 2FA required, proceeding with login');
				// Set token in API client
				api.setToken(accessToken);

				// store tokens in localStorage for persistence
				localStorage.setItem('accessToken', accessToken);
				if (refreshToken) {
					localStorage.setItem('refreshToken', refreshToken);
				}

				// Redirect to home page
				window.location.href = '/';
			} catch (err) {
				console.error('OAuth callback error:', err);
				setError('Failed to complete login. Please try again.');
				// Redirect to login after 3 seconds
				setTimeout(() => {
					window.location.href = '/';
				}, 3000);
			}
		};

		handleCallback();
	}, []);

	if (error) {
		return (
			<div style={{padding: '20px', textAlign: 'center'}}>
				<h2>Authentication Error</h2>
				<p>{error}</p>
				<p>Redirecting to login...</p>
			</div>
		);
	}

	return (
		<div style={{padding: '20px', textAlign: 'center'}}>
			<h2>Completing login...</h2>
			<p>Please wait while we log you in.</p>
		</div>
	);
}

export default OAuthCallback;
