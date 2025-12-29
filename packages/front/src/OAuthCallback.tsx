import {useEffect, useState} from 'react';
import {api} from './api/client';

function OAuthCallback() {
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const handleCallback = async () => {
			try {
				// Get token from URL query parameter
				const params = new URLSearchParams(window.location.search);
				const token = params.get('token');

				if (!token) {
					setError('No token received from OAuth provider');
					return;
				}

				// Set token in API client
				api.setToken(token);

				// Fetch user profile to verify token works
				const profile = await api.getProfile();
				
				// Store token in localStorage for persistence
				localStorage.setItem('accessToken', token);

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
