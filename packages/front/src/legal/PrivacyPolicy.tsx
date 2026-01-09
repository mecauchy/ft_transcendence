import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen bg-slate-900 text-white p-8 pt-24">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-bold mb-8">{t('legal.privacyPolicy.title', 'Privacy Policy')}</h1>
				
				<div className="space-y-6 text-gray-300">
					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.lastUpdated', 'Last Updated')}</h2>
						<p>{new Date().toLocaleDateString()}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.introduction.title', '1. Introduction')}</h2>
						<p>{t('legal.privacyPolicy.introduction.content', 'Welcome to ft_transcendence. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our gaming platform.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.dataCollection.title', '2. Data We Collect')}</h2>
						<p className="mb-3">{t('legal.privacyPolicy.dataCollection.intro', 'We collect the following types of data:')}</p>
						<ul className="list-disc pl-6 space-y-2">
							<li><strong>{t('legal.privacyPolicy.dataCollection.account', 'Account Information:')}</strong> {t('legal.privacyPolicy.dataCollection.accountDesc', 'Username, email address, hashed password, and profile avatar.')}</li>
							<li><strong>{t('legal.privacyPolicy.dataCollection.game', 'Game Data:')}</strong> {t('legal.privacyPolicy.dataCollection.gameDesc', 'Match history, scores, wins/losses, achievements, and XP progression.')}</li>
							<li><strong>{t('legal.privacyPolicy.dataCollection.social', 'Social Data:')}</strong> {t('legal.privacyPolicy.dataCollection.socialDesc', 'Friends list, chat messages, and blocked users.')}</li>
							<li><strong>{t('legal.privacyPolicy.dataCollection.technical', 'Technical Data:')}</strong> {t('legal.privacyPolicy.dataCollection.technicalDesc', 'IP address, browser type, and device information for security purposes.')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.dataUse.title', '3. How We Use Your Data')}</h2>
						<ul className="list-disc pl-6 space-y-2">
							<li>{t('legal.privacyPolicy.dataUse.provide', 'To provide and maintain our gaming service')}</li>
							<li>{t('legal.privacyPolicy.dataUse.account', 'To manage your account and enable game features')}</li>
							<li>{t('legal.privacyPolicy.dataUse.matchmaking', 'To enable matchmaking and leaderboards')}</li>
							<li>{t('legal.privacyPolicy.dataUse.communicate', 'To communicate with you about your account')}</li>
							<li>{t('legal.privacyPolicy.dataUse.security', 'To ensure security and prevent abuse')}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.dataStorage.title', '4. Data Storage and Security')}</h2>
						<p>{t('legal.privacyPolicy.dataStorage.content', 'Your data is stored securely using industry-standard encryption. Passwords are hashed and salted. We use HTTPS for all communications and implement rate limiting to prevent abuse.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.gdpr.title', '5. Your Rights (GDPR)')}</h2>
						<p className="mb-3">{t('legal.privacyPolicy.gdpr.intro', 'Under GDPR regulations, you have the following rights:')}</p>
						<ul className="list-disc pl-6 space-y-2">
							<li><strong>{t('legal.privacyPolicy.gdpr.access', 'Right of Access:')}</strong> {t('legal.privacyPolicy.gdpr.accessDesc', 'Request a copy of your personal data.')}</li>
							<li><strong>{t('legal.privacyPolicy.gdpr.rectification', 'Right to Rectification:')}</strong> {t('legal.privacyPolicy.gdpr.rectificationDesc', 'Update or correct your personal data.')}</li>
							<li><strong>{t('legal.privacyPolicy.gdpr.erasure', 'Right to Erasure:')}</strong> {t('legal.privacyPolicy.gdpr.erasureDesc', 'Request deletion of your account and data.')}</li>
							<li><strong>{t('legal.privacyPolicy.gdpr.portability', 'Right to Data Portability:')}</strong> {t('legal.privacyPolicy.gdpr.portabilityDesc', 'Export your data in JSON, CSV, or XML format.')}</li>
						</ul>
						<p className="mt-3">{t('legal.privacyPolicy.gdpr.howTo', 'You can exercise these rights through the Settings page in your account.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.cookies.title', '6. Cookies and Local Storage')}</h2>
						<p>{t('legal.privacyPolicy.cookies.content', 'We use essential cookies and local storage to maintain your session and preferences. These are necessary for the application to function properly.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.thirdParty.title', '7. Third-Party Services')}</h2>
						<p>{t('legal.privacyPolicy.thirdParty.content', 'We may integrate with OAuth providers (such as 42) for authentication. When using third-party authentication, their respective privacy policies also apply.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.children.title', '8. Children\'s Privacy')}</h2>
						<p>{t('legal.privacyPolicy.children.content', 'Our service is not directed to children under 13. We do not knowingly collect personal data from children under 13.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.changes.title', '9. Changes to This Policy')}</h2>
						<p>{t('legal.privacyPolicy.changes.content', 'We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.')}</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">{t('legal.privacyPolicy.contact.title', '10. Contact Us')}</h2>
						<p>{t('legal.privacyPolicy.contact.content', 'If you have any questions about this privacy policy or our data practices, please contact us through the platform.')}</p>
					</section>
				</div>

				<div className="mt-8 pt-6 border-t border-white/10">
					<p className="text-sm text-gray-500">{t('legal.privacyPolicy.footer', 'This privacy policy is compliant with GDPR and other applicable data protection regulations.')}</p>
				</div>
			</div>
		</div>
	);
}
