import { useTranslation } from 'react-i18next';

export default function TermsOfService() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen bg-slate-900 text-white p-8 pt-24">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-bold mb-8">{t('legal.termsOfService.title', 'Terms of Service')}</h1>
				
				<div className="space-y-6 text-gray-300">
					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.lastUpdated', 'Last Updated')}</h2>
						<p>{new Date().toLocaleDateString()}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.acceptance.title', '1. Acceptance of Terms')}</h2>
						<p>{t('legal.termsOfService.acceptance.content', 'By accessing and using ft_transcendence, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.description.title', '2. Service Description')}</h2>
						<p>{t('legal.termsOfService.description.content', 'ft_transcendence is a web-based multiplayer gaming platform featuring Pong and other games. The service includes real-time gameplay, chat functionality, friend systems, leaderboards, and gamification features.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.accounts.title', '3. User Accounts')}</h2>
						<ul className="list-disc pl-6 space-y-2">
							<li>{t('legal.termsOfService.accounts.accurate', 'You must provide accurate and complete registration information.')}</li>
							<li>{t('legal.termsOfService.accounts.secure', 'You are responsible for maintaining the security of your account credentials.')}</li>
							<li>{t('legal.termsOfService.accounts.activity', 'You are responsible for all activities that occur under your account.')}</li>
							<li>{t('legal.termsOfService.accounts.notify', 'You must notify us immediately of any unauthorized use of your account.')}</li>
							<li>{t('legal.termsOfService.accounts.age', 'You must be at least 13 years old to create an account.')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.conduct.title', '4. Acceptable Use')}</h2>
						<p className="mb-3">{t('legal.termsOfService.conduct.intro', 'You agree not to:')}</p>
						<ul className="list-disc pl-6 space-y-2">
							<li>{t('legal.termsOfService.conduct.abuse', 'Harass, abuse, or harm other users')}</li>
							<li>{t('legal.termsOfService.conduct.cheat', 'Use cheats, exploits, or automation software')}</li>
							<li>{t('legal.termsOfService.conduct.impersonate', 'Impersonate other users or 42 staff')}</li>
							<li>{t('legal.termsOfService.conduct.spam', 'Send spam or unsolicited messages')}</li>
							<li>{t('legal.termsOfService.conduct.interfere', 'Attempt to interfere with the service\'s security or functionality')}</li>
							<li>{t('legal.termsOfService.conduct.illegal', 'Use the service for any illegal purpose')}</li>
							<li>{t('legal.termsOfService.conduct.offensive', 'Post offensive, discriminatory, or inappropriate content')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.content.title', '5. User Content')}</h2>
						<p>{t('legal.termsOfService.content.content', 'You retain ownership of content you create (avatars, chat messages). However, you grant us a license to display this content within the service. We reserve the right to remove content that violates these terms.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.gameplay.title', '6. Game Rules and Fair Play')}</h2>
						<ul className="list-disc pl-6 space-y-2">
							<li>{t('legal.termsOfService.gameplay.fair', 'All games must be played fairly and in good faith.')}</li>
							<li>{t('legal.termsOfService.gameplay.disconnect', 'Intentionally disconnecting to avoid losses may result in penalties.')}</li>
							<li>{t('legal.termsOfService.gameplay.rankings', 'Rankings and leaderboards are determined by legitimate gameplay only.')}</li>
							<li>{t('legal.termsOfService.gameplay.manipulation', 'Score manipulation or match-fixing is prohibited.')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.privacy.title', '7. Privacy')}</h2>
						<p>{t('legal.termsOfService.privacy.content', 'Your use of the service is also governed by our Privacy Policy. Please review it to understand how we collect, use, and protect your data.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.termination.title', '8. Account Termination')}</h2>
						<p className="mb-3">{t('legal.termsOfService.termination.content', 'We may suspend or terminate your account if you violate these terms. You may also delete your account at any time through the Settings page.')}</p>
						<p>{t('legal.termsOfService.termination.data', 'Upon account deletion, your personal data will be removed in accordance with our Privacy Policy and GDPR requirements.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.disclaimer.title', '9. Disclaimer of Warranties')}</h2>
						<p>{t('legal.termsOfService.disclaimer.content', 'The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service. This is an educational project developed as part of the 42 curriculum.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.liability.title', '10. Limitation of Liability')}</h2>
						<p>{t('legal.termsOfService.liability.content', 'We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.changes.title', '11. Changes to Terms')}</h2>
						<p>{t('legal.termsOfService.changes.content', 'We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.governing.title', '12. Governing Law')}</h2>
						<p>{t('legal.termsOfService.governing.content', 'These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through appropriate legal channels.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.termsOfService.contact.title', '13. Contact')}</h2>
						<p>{t('legal.termsOfService.contact.content', 'If you have any questions about these Terms of Service, please contact us through the platform.')}</p>
					</section>
				</div>

				<div className="mt-8 pt-6 border-t border-white/10">
					<p className="text-sm text-gray-500">{t('legal.termsOfService.footer', 'By using ft_transcendence, you acknowledge that you have read and understood these Terms of Service.')}</p>
				</div>
			</div>
		</div>
	);
}
