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

				if (encodedData) {
					try {
						const decoded = JSON.parse(atob(encodedData));
						accessToken = decoded.accessToken;
						refreshToken = decoded.refreshToken;
						require2FA = decoded.require2FA || false;
						userId = decoded.userId || null;
					} catch {
						// else try without decode
						accessToken = params.get('token');
					}
				} else {
					// fallback to old format for backward compatibility
					accessToken = params.get('token');
				}

				if (!accessToken) {
					setError('No token received from OAuth provider');
					return;
				}

				// check 2fa requirement
				if (require2FA && userId) {
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
